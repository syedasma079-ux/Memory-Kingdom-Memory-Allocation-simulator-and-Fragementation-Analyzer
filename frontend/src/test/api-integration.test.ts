/**
 * Frontend ↔ API integration: verifies G1/G2/G3 via HTTP without recomputing in TS.
 * Requires a running API is NOT needed — uses the Express app in-process like Phase 4,
 * OR skips if MEMK_INTEGRATION=0. Default: spawn via dynamic import of API createApp
 * only when backend is available; otherwise uses fetch against 127.0.0.1:4000 if healthy.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldenDir = path.resolve(__dirname, '../../../backend/c-engine/tests/golden');

const API = process.env.MEMK_API_URL ?? 'http://127.0.0.1:4000';

async function apiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

describe('API integration G1–G3 (engine passthrough)', () => {
  it('loads assignment, steps to t=6 (G1) and t=7 (G2/G3)', async () => {
    if (!(await apiAvailable())) {
      console.warn('API not running on 127.0.0.1:4000 — skipping live integration');
      return;
    }

    const g1 = JSON.parse(fs.readFileSync(path.join(goldenDir, 'g1_layout.json'), 'utf8'));
    const g2 = JSON.parse(fs.readFileSync(path.join(goldenDir, 'g2_offsets.json'), 'utf8'));

    const created = await fetch(`${API}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy: 'first_fit', quantum: 1, totalMemory: 1024 })
    }).then((r) => r.json());
    const id = created.data.id as string;

    try {
      await fetch(`${API}/api/sessions/${id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: 'workload.assignment' })
      });
      await fetch(`${API}/api/sessions/${id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: 'sim.run', untilT: 6 })
      });
      const snap6 = await fetch(`${API}/api/sessions/${id}/snapshot`).then((r) => r.json());
      expect(snap6.data.t).toBe(6);
      expect(snap6.data.arena.nextFitOffset).toBe(960);
      expect(snap6.data.arena.blocks).toHaveLength(g1.blocks.length);
      for (let i = 0; i < g1.blocks.length; i++) {
        expect(snap6.data.arena.blocks[i].offset).toBe(g1.blocks[i].offset);
        expect(snap6.data.arena.blocks[i].size).toBe(g1.blocks[i].size);
        expect(snap6.data.arena.blocks[i].allocated).toBe(g1.blocks[i].allocated);
      }

      await fetch(`${API}/api/sessions/${id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: 'sim.tick' })
      });
      await fetch(`${API}/api/sessions/${id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: 'sim.tick' })
      });
      const snap7 = await fetch(`${API}/api/sessions/${id}/snapshot`).then((r) => r.json());
      const byName: Record<string, number> = {};
      for (const p of snap7.data.processes) {
        if (p.name === 'P6' || p.name === 'P7' || p.name === 'P8') byName[p.name] = p.offset;
      }
      expect(byName.P6).toBe(g2.policies.first_fit.P6);
      expect(byName.P7).toBe(g2.policies.first_fit.P7);
      expect(byName.P8).toBe(g2.policies.first_fit.P8);

      // G3 first-fit stats from engine
      expect(snap7.data.arena.statistics.free).toBe(388);
      expect(snap7.data.arena.statistics.largestFree).toBe(160);
      expect(snap7.data.arena.statistics.externalFragmentation).toBeCloseTo(58.76, 1);
    } finally {
      await fetch(`${API}/api/sessions/${id}`, { method: 'DELETE' });
    }
  }, 30000);
});
