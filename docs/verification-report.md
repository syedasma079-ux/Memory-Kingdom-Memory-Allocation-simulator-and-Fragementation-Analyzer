# MEMORY KINGDOM Verification Report

This report records the actual command executions and test outputs at each phase gate.

---

## Phase 1: Engine Core

### Gate Requirements:
1. Golden fixtures copied and committed with `golden-lock` tag.
2. `make check` green under normal and ASan+UBSan builds.
3. G1, G2, G3 pass for all four policies (First Fit, Next Fit, Best Fit, Worst Fit).
4. Next Fit pointer-safety suite passes (all 9 cases).
5. G1 dump matches exactly for all policies.
6. Single-source-of-truth check (`scripts/check-single-source.sh`) passes.

### Gate 1 Status: PASSED

---

## Phase 2: Scheduler Core and Virtual Executor

### Gate Requirements:
1. Tick algorithm, queues (Input, User Job, Q1, Q2, Q3, Running slot), and states implemented.
2. Every assumption ASM-1 to ASM-12 configurable as runtime options.
3. Scheduler tests pass under all combinations of ASM-1 and ASM-2 values.
4. G1 to G3 reproduced through scheduler and protocol for all four policies.
5. Head-of-line blocking (ASM-2) and multilevel priority demotion (ASM-1, ASM-5) verified.
6. Full JSON Lines protocol (`session.configure`, `workload.load`, `workload.assignment`, `workload.random`, `sim.tick`, `sim.run`, `sim.reset`, `snapshot.get`, `arena.alloc`, `arena.free`, `compare.run`).
7. Protocol fuzzer (static malformed and randomized ASCII cases) passes without crashes.
8. `make check` passes under Normal and `ASan + UBSan` builds.
9. Golden fixtures confirmed untouched against `golden-lock`.

### Gate 2 Status: PASSED

---

## Phase 3: Linux Mode (POSIX Dispatcher & Worker)

### Gate Requirements:
1. `memk-worker` process executable:
   - Handles `SIGINT` (clean exit 0).
   - Installs `SIGTSTP` handler that calls `raise(SIGSTOP)` to ensure stoppage even in non-interactive / orphaned process groups.
   - Prevents orphaned processes via `prctl(PR_SET_PDEATHSIG, SIGKILL)` and `getppid() == 1` checks.
2. `PosixExecutor` implementation (`src/posix-executor.c`, `include/posix-executor.h`):
   - Real `fork()` and `execv()` using absolute worker binary path.
   - Signals: `SIGTSTP` to suspend running process, `SIGCONT` to resume, `SIGINT` to terminate.
   - Grace period wait and force `SIGKILL` reaping to ensure zero zombies remain.
   - Signal protection: signals sent strictly to owned child PIDs (`pid > 1`), never to 0, -1, or unrelated PIDs.
3. `linux-mode-tests`:
   - `test_real_signal_sequence`: passes (running $\rightarrow$ `SIGTSTP` stopped $\rightarrow$ `SIGCONT` resumed $\rightarrow$ `SIGINT` reaped).
   - `test_zombie_prevention`: passes (inspects `/proc` confirming 0 zombies).
   - `test_unrelated_pid_protection`: passes (refuses to signal unowned or invalid PIDs).
   - `test_orphan_prevention`: passes (parent dispatcher killed with `SIGKILL` mid-run triggers immediate kernel-level termination of child worker via `PDEATHSIG`).
   - `test_posix_virtual_parity`: passes (exact event sequence, process offsets, states, and arena layout parity with `VirtualExecutor` on assignment dataset).
4. `make check` passes under Normal and `ASan + UBSan` builds.

### Gate 3 Status: PASSED

---

## Phase 4: API (Walking Skeleton End-to-End)

### Gate Requirements:
1. Express API (127.0.0.1 only) with strict CORS, 256 KB body limit, and 8 session concurrency limit.
2. C engine bridge communicating over JSON Lines pipes with spawned `memk-sim` and `memk-dispatch`.
3. Server-Sent Events (SSE) stream on `/api/sessions/:id/events` with `Last-Event-ID` resume and 15s heartbeats.
4. All REST endpoints functional:
   - `POST /api/sessions`, `DELETE /api/sessions/:id`
   - `POST /api/sessions/:id/commands` (validated by Zod whitelist)
   - `GET /api/sessions/:id/snapshot`
   - `GET /api/sessions/:id/report?format=json|md|csv`
   - `POST /api/compare`
   - `GET /api/dataset/assignment`
   - `GET /api/health`
5. Single Source of Truth enforced (`scripts/check-single-source.sh` passes; no allocation logic in TypeScript).
6. Passthrough verification: raw offsets, sizes, and dragonPower/stats verified to pass byte-identical from C to client.
7. Thin script (`scripts/drive-assignment.ts`) driving assignment dataset through HTTP reproduces G1 to G3.

### Verification Run Output:

```
>>> 4. Verifying Node.js / Express API...

> memory-kingdom-api@1.0.0 test
> vitest run


 RUN  v2.1.9 /home/ramita/projects/memory-kingdom/backend/api

 ✓ tests/api.test.ts (10 tests) 291ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  10:47:58
   Duration  2.21s (transform 430ms, setup 0ms, collect 817ms, tests 291ms, environment 1ms, prepare 282ms)

=== MEMORY KINGDOM: Thin API Drive Script ===
>>> 1. Creating session via POST /api/sessions...
Session created: e629e86b-d086-448c-b4b7-4cd165f34dc3
>>> 2. Loading assignment dataset via POST /api/sessions/:id/commands...
>>> 3. Running simulation to t=6...
>>> 4. Verifying G1 layout at t=6 via GET /api/sessions/:id/snapshot...
G1 verification: PASSED (exact match)
>>> 5. Stepping to t=7 and verifying G2 offsets...
G2 verification: PASSED (P6=0, P7=224, P8=108)
>>> 6. Verifying G3 statistics...
G3 verification: PASSED (free=388 MB, largestFree=160 MB, extFrag=58.76%)
Session destroyed.
==========================================
ALL API HTTP VERIFICATION CHECKS PASSED
==========================================
```

### Gate 4 Status: PASSED


---

## Phase 5: Functional Frontend

### Gate Requirements:
1. Connects to Express API over REST and Server-Sent Events (SSE).
2. Pure event-sourced Zustand store displaying snapshots and statistics directly from C engine.
3. Proportional 2D memory realm mapping (8 rows of 128 MB = 1024 MB total).
4. All 10 locations navigable and interactive:
   - Kingdom Overview
   - Memory Arena
   - Algorithm Guild
   - Process Tavern
   - Feedback Castle
   - Fragmentation Dungeon
   - Strategy Room
   - Quest Board
   - Chronicles
   - System Settings
5. Quests Q1–Q4 executable with C engine layout presets.
6. Single source of truth enforced (`scripts/check-single-source.sh` passes; no allocation logic in TS/React).
7. TypeScript compile (`tsc`) and Vite bundle build (`vite build`) succeed with 0 errors.
8. Navigation tests and unit test suites pass 100%.
9. Live API integration test reproduces G1 ($t=6$), G2 ($t=7$), and G3 derived stats.

### Verification Run Output:

```
>>> 5. Verifying React frontend (typecheck, unit tests, build)...

> memory-kingdom-frontend@1.0.0 test
> vitest run

 ✓ src/oracle/templates.test.ts (2 tests) 19ms
 ✓ src/test/api-integration.test.ts (1 test) 95ms
 ✓ src/memory-arena/layoutBlocks.test.ts (3 tests) 34ms
 ✓ src/quests/solutions.test.ts (4 tests) 59ms
 ✓ src/store/simStore.test.ts (4 tests) 27ms
 ✓ src/test/passthrough.test.tsx (2 tests) 233ms
 ✓ src/animations/eventClips.test.ts (2 tests) 15ms
 ✓ src/test/navigation.test.tsx (1 test) 3230ms

 Test Files  8 passed (8)
      Tests  19 passed (19)

> memory-kingdom-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 664 modules transformed.
dist/index.html                                                      0.44 kB │ gzip:   0.30 kB
dist/assets/index-DXPq9TZW.css                                      31.72 kB │ gzip:  14.09 kB
dist/assets/index-DGjDfPf9.js                                      582.96 kB │ gzip: 167.70 kB
✓ built in 8.19s
==========================================
 ALL VERIFICATION CHECKS PASSED           
==========================================
```

### Gate 5 Status: PASSED
