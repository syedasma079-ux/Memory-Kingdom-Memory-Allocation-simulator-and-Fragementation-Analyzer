import http from 'http';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app.js';
import { SessionManager } from '../src/session-manager.js';

async function main() {
  console.log('=== MEMORY KINGDOM: Thin API Drive Script ===');

  const sessionManager = new SessionManager();
  const { app } = createApp(sessionManager);

  const server = app.listen(4001, '127.0.0.1');

  try {
    // 1. Create session
    console.log('>>> 1. Creating session via POST /api/sessions...');
    const createRes = await fetch('http://127.0.0.1:4001/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy: 'first_fit', quantum: 1, totalMemory: 1024 })
    });
    const createJson = await createRes.json() as any;
    if (!createJson.ok) throw new Error('Failed to create session');
    const sessionId = createJson.data.id;
    console.log(`Session created: ${sessionId}`);

    // 2. Load assignment workload
    console.log('>>> 2. Loading assignment dataset via POST /api/sessions/:id/commands...');
    const loadRes = await fetch(`http://127.0.0.1:4001/api/sessions/${sessionId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'workload.assignment' })
    });
    const loadJson = await loadRes.json() as any;
    if (!loadJson.ok) throw new Error('Failed to load workload');

    // 3. Run to t=6
    console.log('>>> 3. Running simulation to t=6...');
    await fetch(`http://127.0.0.1:4001/api/sessions/${sessionId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'sim.run', untilT: 6 })
    });

    // 4. Fetch snapshot and verify G1
    console.log('>>> 4. Verifying G1 layout at t=6 via GET /api/sessions/:id/snapshot...');
    const snap6Res = await fetch(`http://127.0.0.1:4001/api/sessions/${sessionId}/snapshot`);
    const snap6Json = await snap6Res.json() as any;
    const snap6 = snap6Json.data;

    const goldenG1 = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), '../c-engine/tests/golden/g1_layout.json'), 'utf8')
    );

    if (snap6.t !== 6) throw new Error(`Expected t=6, got ${snap6.t}`);
    if (snap6.arena.nextFitOffset !== 960) throw new Error(`Expected nextFitOffset 960, got ${snap6.arena.nextFitOffset}`);

    for (let i = 0; i < goldenG1.blocks.length; i++) {
      const actual = snap6.arena.blocks[i];
      const expected = goldenG1.blocks[i];
      if (actual.offset !== expected.offset || actual.size !== expected.size || actual.allocated !== expected.allocated) {
        throw new Error(`G1 Block ${i} mismatch!`);
      }
    }
    console.log('G1 verification: PASSED (exact match)');

    // 5. Advance to t=7 and verify G2
    console.log('>>> 5. Stepping to t=7 and verifying G2 offsets...');
    await fetch(`http://127.0.0.1:4001/api/sessions/${sessionId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'sim.tick' }) // boundary t=6
    });
    await fetch(`http://127.0.0.1:4001/api/sessions/${sessionId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'sim.tick' }) // boundary t=7 admission
    });

    const snap7Res = await fetch(`http://127.0.0.1:4001/api/sessions/${sessionId}/snapshot`);
    const snap7Json = await snap7Res.json() as any;
    const snap7 = snap7Json.data;

    const p6 = snap7.processes.find((p: any) => p.pid === 6);
    const p7 = snap7.processes.find((p: any) => p.pid === 7);
    const p8 = snap7.processes.find((p: any) => p.pid === 8);

    if (p6.offset !== 0 || p7.offset !== 224 || p8.offset !== 108) {
      throw new Error(`G2 offsets mismatch! P6=${p6.offset}, P7=${p7.offset}, P8=${p8.offset}`);
    }
    console.log('G2 verification: PASSED (P6=0, P7=224, P8=108)');

    // 6. Verify G3 statistics
    console.log('>>> 6. Verifying G3 statistics...');
    const stats = snap7.arena.statistics;
    if (stats.free !== 388 || stats.largestFree !== 160) {
      throw new Error(`G3 stats mismatch! free=${stats.free}, largestFree=${stats.largestFree}`);
    }
    console.log(`G3 verification: PASSED (free=388 MB, largestFree=160 MB, extFrag=${stats.externalFragmentation.toFixed(2)}%)`);

    // Clean up session
    await fetch(`http://127.0.0.1:4001/api/sessions/${sessionId}`, { method: 'DELETE' });
    console.log('Session destroyed.');

    console.log('==========================================');
    console.log('ALL API HTTP VERIFICATION CHECKS PASSED');
    console.log('==========================================');
  } finally {
    await sessionManager.shutdown();
    server.close();
  }
}

main().catch(err => {
  console.error('API verification failed:', err);
  process.exit(1);
});

