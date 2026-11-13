import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/session-manager.js';
import path from 'path';
import fs from 'fs';

describe('Phase 4: Node.js / Express API Integration Tests', () => {
  let app: any;
  let sessionManager: SessionManager;
  let sessionId: string;

  beforeAll(async () => {
    sessionManager = new SessionManager();
    const appObj = createApp(sessionManager);
    app = appObj.app;
  });

  afterAll(async () => {
    await sessionManager.shutdown();
  });

  it('GET /api/health should return ok and active sessions', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.activeSessions).toBe(0);
  });

  it('GET /api/dataset/assignment should return standard assignment processes', async () => {
    const res = await request(app).get('/api/dataset/assignment');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(9);
    expect(res.body.data[0].memMb).toBe(192);
  });

  it('POST /api/sessions should create a new session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ policy: 'first_fit', quantum: 1, totalMemory: 1024 });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBeDefined();
    sessionId = res.body.data.id;
  });

  it('POST /api/sessions/:id/commands should reject invalid commands', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/commands`)
      .send({ cmd: 'invalid.command' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/sessions/:id/commands should load assignment workload and reproduce G1 at t=6', async () => {
    // 1. Load assignment workload
    let res = await request(app)
      .post(`/api/sessions/${sessionId}/commands`)
      .send({ cmd: 'workload.assignment' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // 2. Run until t=6
    res = await request(app)
      .post(`/api/sessions/${sessionId}/commands`)
      .send({ cmd: 'sim.run', untilT: 6 });
    expect(res.status).toBe(200);

    // 3. Fetch snapshot
    const snapRes = await request(app).get(`/api/sessions/${sessionId}/snapshot`);
    expect(snapRes.status).toBe(200);
    expect(snapRes.body.ok).toBe(true);
    const snap = snapRes.body.data;

    expect(snap.t).toBe(6);
    expect(snap.arena.nextFitOffset).toBe(960);

    // Load golden G1 fixture
    const goldenG1 = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../c-engine/tests/golden/g1_layout.json'), 'utf8')
    );

    expect(snap.arena.blocks).toHaveLength(goldenG1.blocks.length);
    for (let i = 0; i < goldenG1.blocks.length; i++) {
      expect(snap.arena.blocks[i].offset).toBe(goldenG1.blocks[i].offset);
      expect(snap.arena.blocks[i].size).toBe(goldenG1.blocks[i].size);
      expect(snap.arena.blocks[i].allocated).toBe(goldenG1.blocks[i].allocated);
    }
  });

  it('POST /api/sessions/:id/commands should advance to t=7 and reproduce G2 allocation offsets', async () => {
    // Advance to t=7
    let res = await request(app)
      .post(`/api/sessions/${sessionId}/commands`)
      .send({ cmd: 'sim.tick' }); // t=6 -> 7
    expect(res.status).toBe(200);

    res = await request(app)
      .post(`/api/sessions/${sessionId}/commands`)
      .send({ cmd: 'sim.tick' }); // t=7 boundary admission
    expect(res.status).toBe(200);

    const snapRes = await request(app).get(`/api/sessions/${sessionId}/snapshot`);
    expect(snapRes.status).toBe(200);
    const snap = snapRes.body.data;

    // G2 First Fit offsets: P6=0, P7=224, P8=108
    const p6 = snap.processes.find((p: any) => p.pid === 6);
    const p7 = snap.processes.find((p: any) => p.pid === 7);
    const p8 = snap.processes.find((p: any) => p.pid === 8);

    expect(p6.offset).toBe(0);
    expect(p7.offset).toBe(224);
    expect(p8.offset).toBe(108);

    // G3 Statistics
    expect(snap.arena.statistics.free).toBe(388);
    expect(snap.arena.statistics.largestFree).toBe(160);
    expect(snap.arena.statistics.externalFragmentation).toBeCloseTo(58.76, 1);
  });

  it('GET /api/sessions/:id/report should export reports in JSON, Markdown, and CSV', async () => {
    const jsonRes = await request(app).get(`/api/sessions/${sessionId}/report?format=json`);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.body.sessionId).toBe(sessionId);

    const mdRes = await request(app).get(`/api/sessions/${sessionId}/report?format=md`);
    expect(mdRes.status).toBe(200);
    expect(mdRes.text).toContain('# MEMORY KINGDOM Simulation Report');
    expect(mdRes.text).toContain('ASM-1');

    const csvRes = await request(app).get(`/api/sessions/${sessionId}/report?format=csv`);
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain('Config,Policy,first_fit');
  });

  it('POST /api/compare should run 4-policy comparison in C engine and return metrics', async () => {
    const res = await request(app).post('/api/compare').send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.results).toHaveLength(4);

    const policies = res.body.data.results.map((r: any) => r.policy);
    expect(policies).toContain('first_fit');
    expect(policies).toContain('next_fit');
    expect(policies).toContain('best_fit');
    expect(policies).toContain('worst_fit');
  });

  it('Single Source of Truth / Passthrough Test: verifies raw C engine values pass through unmodified', async () => {
    const snapRes = await request(app).get(`/api/sessions/${sessionId}/snapshot`);
    const snap = snapRes.body.data;

    // Verify all arithmetic invariants directly from snapshot
    let sumSize = 0;
    for (const b of snap.arena.blocks) {
      sumSize += b.size;
    }
    expect(sumSize).toBe(snap.arena.total);
    expect(snap.arena.statistics.allocated + snap.arena.statistics.free).toBe(snap.arena.total);
    expect(snap.arena.statistics.dragonPower).toBe(snap.arena.statistics.externalFragmentation);
  });

  it('Custom Workload & Variable Memory: loads custom jobs and runs simulation through C engine', async () => {
    const customSessionRes = await request(app)
      .post('/api/sessions')
      .send({ policy: 'first_fit', quantum: 1, totalMemory: 512 });
    expect(customSessionRes.status).toBe(201);
    const customId = customSessionRes.body.data.id;

    // Load custom workload
    const jobs = [
      { arrival: 0, priority: 1, cpuBurst: 2, memMb: 128, name: 'P0' },
      { arrival: 0, priority: 2, cpuBurst: 3, memMb: 192, name: 'P1' }
    ];
    const loadRes = await request(app)
      .post(`/api/sessions/${customId}/commands`)
      .send({ cmd: 'workload.load', jobs });
    expect(loadRes.status).toBe(200);
    expect(loadRes.body.ok).toBe(true);
    expect(loadRes.body.data.jobCount).toBe(2);

    // Run simulation to completion
    const runRes = await request(app)
      .post(`/api/sessions/${customId}/commands`)
      .send({ cmd: 'sim.run', untilT: -1 });
    expect(runRes.status).toBe(200);
    expect(runRes.body.data.isFinished).toBe(true);

    // Verify snapshot
    const snapRes = await request(app).get(`/api/sessions/${customId}/snapshot`);
    expect(snapRes.status).toBe(200);
    const snap = snapRes.body.data;
    expect(snap.arena.total).toBe(512);
    expect(snap.processes).toHaveLength(2);
    expect(snap.processes[0].state).toBe('TERMINATED');
    expect(snap.processes[1].state).toBe('TERMINATED');

    await request(app).delete(`/api/sessions/${customId}`);
  });

  it('POST /api/compare with custom jobs and totalMemory compares all 4 algorithms on identical custom workload', async () => {
    const jobs = [
      { arrival: 0, priority: 1, cpuBurst: 2, memMb: 128 },
      { arrival: 1, priority: 2, cpuBurst: 2, memMb: 64 }
    ];
    const res = await request(app)
      .post('/api/compare')
      .send({ jobs, totalMemory: 512 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.results).toHaveLength(4);
    for (const r of res.body.data.results) {
      expect(r.makespan).toBeGreaterThan(0);
      expect(r.totalFree).toBeLessThanOrEqual(512);
    }
  });

  it('DELETE /api/sessions/:id should delete the session and terminate child C process', async () => {
    const res = await request(app).delete(`/api/sessions/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const getRes = await request(app).get(`/api/sessions/${sessionId}/snapshot`);
    expect(getRes.status).toBe(404);
  });
});

