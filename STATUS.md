# MEMORY KINGDOM Project Status

## Current Phase: Phase 4 (API - Walking Skeleton End-to-End)

### Phase Gates Progress
- [x] **Phase 1: Engine Core** - **PASSED**
  - Verbatim C `struct mab` and 5 functions with exact signatures
  - Arena layer with pointer safety suite (all 9 test cases passing)
  - Golden fixtures locked under git tag `golden-lock`
  - G1, G2, G3 verified for all four policies
  - Passed under normal & `ASan + UBSan` builds
- [x] **Phase 2: Scheduler Core and Virtual Executor** - **PASSED**
  - Input list, User Job Queue, Feedback queues Q1, Q2, Q3, running slot
  - Process state machine: `NOT_ARRIVED`, `WAITING_FOR_MEMORY`, `READY`, `RUNNING`, `SUSPENDED`, `TERMINATED`
  - Tick boundary algorithm with strict step order (ASM-3)
  - Multilevel feedback priority demotion (ASM-1, ASM-5) & head-of-line blocking (ASM-2)
  - Verified across all ASM-1 and ASM-2 parameter combinations
  - Complete JSON Lines protocol server in `memk-sim`
  - Protocol fuzzer (static malformed & 500 randomized ASCII cases) passed without crashes
- [x] **Phase 3: Linux Mode (POSIX Dispatcher & Worker)** - **PASSED**
  - `memk-worker` process executable (clean SIGINT, SIGTSTP $\rightarrow$ SIGSTOP, `PR_SET_PDEATHSIG` orphan prevention)
  - `PosixExecutor` implementation (`fork`, `execv`, `SIGINT`, `SIGTSTP`, `SIGCONT`, `waitpid`, pacing)
  - `memk-dispatch` executable
  - Signal sequence test passed
  - Zombie prevention test passed (verified 0 zombies in `/proc`)
  - Unrelated PID protection test passed (signals restricted to owned child PIDs $> 1$)
  - Orphan prevention test passed (parent dispatcher termination triggers kernel kill of workers)
  - Parity test passed: identical event sequences, process offsets, and arena layout between `PosixExecutor` and `VirtualExecutor` on assignment dataset
- [ ] **Phase 4: API (Walking Skeleton End-to-End)**
  - Express server (Node 20+, TypeScript, zod)
  - Spawn `memk-sim` / `memk-dispatch` over JSON Lines pipes
  - REST endpoints (`/api/sessions`, `/api/sessions/:id/commands`, `/api/sessions/:id/snapshot`, `/api/sessions/:id/events`, `/api/sessions/:id/report`, `/api/compare`, `/api/health`)
  - Server-Sent Events (SSE) with `Last-Event-ID` resume and heartbeat
  - Enforcement of Single Source of Truth (no allocation/split/merge in Node/TS)
  - Thin script verifying assignment dataset through HTTP reproduces G1 to G3
- [ ] **Phase 5: Functional Frontend (10 Interactive Locations, Store, Pure Snapshots)**
- [ ] **Phase 6: Game Layer (16-bit SNES Pixel Art, Dragon Tiers, Solvable Quests)**
- [ ] **Phase 7: Final Verification & Clean WSL2 Run**

### Next Steps
Begin Phase 4:
1. Initialize `backend/api/` with `package.json`, `tsconfig.json`, Express, Zod, and Vitest.
2. Implement C engine process manager (spawning `memk-sim` or `memk-dispatch` over stdin/stdout pipes).
3. Implement Express routes and SSE stream.
4. Add API integration tests, passthrough test, and dataset reproduction test.
