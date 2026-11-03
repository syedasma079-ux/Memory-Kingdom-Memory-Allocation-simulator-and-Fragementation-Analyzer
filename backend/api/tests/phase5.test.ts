import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/session-manager.js';
import fs from 'fs';
import path from 'path';

describe('Phase 5: sandbox layout + four-policy G2/G3', () => {
  let app: any;
  let sessionManager: SessionManager;

  beforeAll(() => {
    sessionManager = new SessionManager();
    app = createApp(sessionManager).app;
  });

  afterAll(async () => {
    await sessionManager.shutdown();
  });

  it('arena.loadLayout + free neighbor + alloc reproduces a merged hole (Quest 2)', async () => {
    const created = await request(app)
      .post('/api/sessions')
      .send({ policy: 'first_fit', quantum: 1, totalMemory: 1024 });
    const id = created.body.data.id;

    const load = await request(app).post(`/api/sessions/${id}/commands`).send({
      cmd: 'arena.loadLayout',
      blocks: [
        { size: 100, allocated: 0 },
        { size: 50, allocated: 1 },
        { size: 100, allocated: 0 },
        { size: 50, allocated: 1 },
        { size: 724, allocated: 0 }
      ]
    });
    expect(load.status).toBe(200);
    expect(load.body.ok).toBe(true);

    const freed = await request(app)
      .post(`/api/sessions/${id}/commands`)
      .send({ cmd: 'arena.free', offset: 100 });
    expect(freed.body.ok).toBe(true);

    const alloc = await request(app)
      .post(`/api/sessions/${id}/commands`)
      .send({ cmd: 'arena.alloc', size: 200, pid: 42 });
    expect(alloc.body.ok).toBe(true);
    expect(alloc.body.data.offset).toBe(0);
    expect(alloc.body.data.size).toBe(200);

    const snap = await request(app).get(`/api/sessions/${id}/snapshot`);
    const block = snap.body.data.arena.blocks.find((b: { size: number; allocated: boolean }) => b.size === 200);
    expect(block.allocated).toBe(true);
    expect(block.offset).toBe(0);

    await request(app).delete(`/api/sessions/${id}`);
  });

  it('four policies at G2/G3 match golden offsets and engine stats', async () => {
    const g2 = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../c-engine/tests/golden/g2_offsets.json'), 'utf8')
    );
    const g3 = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../c-engine/tests/golden/g3_derived.json'), 'utf8')
    );
    const policies = ['first_fit', 'next_fit', 'best_fit', 'worst_fit'] as const;

    for (const policy of policies) {
      const created = await request(app)
        .post('/api/sessions')
        .send({ policy, quantum: 1, totalMemory: 1024 });
      const id = created.body.data.id;
      await request(app).post(`/api/sessions/${id}/commands`).send({ cmd: 'workload.assignment' });
      await request(app).post(`/api/sessions/${id}/commands`).send({ cmd: 'sim.run', untilT: 6 });
      await request(app).post(`/api/sessions/${id}/commands`).send({ cmd: 'sim.tick' });
      await request(app).post(`/api/sessions/${id}/commands`).send({ cmd: 'sim.tick' });
      const snap = (await request(app).get(`/api/sessions/${id}/snapshot`)).body.data;
      const offsets: Record<string, number> = {};
      for (const p of snap.processes) {
        if (p.name === 'P6' || p.name === 'P7' || p.name === 'P8') offsets[p.name] = p.offset;
      }
      expect(offsets.P6, policy).toBe(g2.policies[policy].P6);
      expect(offsets.P7, policy).toBe(g2.policies[policy].P7);
      expect(offsets.P8, policy).toBe(g2.policies[policy].P8);
      expect(snap.arena.statistics.free).toBe(g3.totalFree);
      expect(snap.arena.statistics.largestFree).toBe(g3[policy].largestFree);
      expect(snap.arena.statistics.externalFragmentation).toBeCloseTo(g3[policy].externalFragmentation, 1);
      await request(app).delete(`/api/sessions/${id}`);
    }
  });
});
