# MEMORY KINGDOM Project Status

## Current Phase: Phase 3 (Linux Mode: POSIX Dispatcher & Worker)

### Phase Gates Progress
- [x] **Phase 1: Engine Core** - **PASSED**
  - Verbatim C `struct mab` and 5 functions with exact signatures
  - Arena layer with `arenaAlloc`, `arenaFree`, `arenaMerge`, `arenaValidate`
  - Next Fit pointer safety suite (all 9 test cases passing)
  - Golden fixtures locked under git tag `golden-lock`
  - G1, G2, G3 verified for all four policies
  - Passed under normal & `ASan + UBSan` builds
- [x] **Phase 2: Scheduler Core and Virtual Executor** - **PASSED**
  - Input list, User Job Queue, Feedback queues Q1, Q2, Q3, running slot
  - Process state machine: `NOT_ARRIVED`, `WAITING_FOR_MEMORY`, `READY`, `RUNNING`, `SUSPENDED`, `TERMINATED`
  - Tick boundary algorithm with strict step order (ASM-3)
  - Multilevel feedback priority demotion (ASM-1, ASM-5)
  - Head-of-line blocking (ASM-2)
  - Verified across all ASM-1 and ASM-2 parameter combinations
  - Complete JSON Lines protocol server in `memk-sim` (`session.configure`, `workload.load`, `workload.assignment`, `workload.random`, `sim.tick`, `sim.run`, `sim.reset`, `snapshot.get`, `arena.alloc`, `arena.free`, `compare.run`)
  - Snapshot generation with side-table PID mapping
  - Protocol fuzzer (static malformed & 500 randomized ASCII cases) passed without crashes
  - Passed under normal & `ASan + UBSan` builds
- [ ] **Phase 3: Linux Mode (POSIX Dispatcher & Worker)**
  - `memk-worker` process executable (clean SIGINT, SIGTSTP -> SIGSTOP, PDEATHSIG)
  - `PosixExecutor` implementation (`fork`, `execv`, `SIGINT`, `SIGTSTP`, `SIGCONT`, `waitpid`, pacing)
  - `memk-dispatch` executable
  - Signal sequence, zombie prevention, orphan prevention, unrelated PID protection
  - Exact event parity between VirtualExecutor and PosixExecutor
- [ ] **Phase 4: API (Node/Express, SSE, Single Source of Truth)**
- [ ] **Phase 5: Functional Frontend (10 Interactive Locations, Store, Pure Snapshots)**
- [ ] **Phase 6: Game Layer (16-bit SNES Pixel Art, Dragon Tiers, Solvable Quests)**
- [ ] **Phase 7: Final Verification & Clean WSL2 Run**

### Next Steps
Begin Phase 3 implementation in `backend/c-engine`:
1. `src/memk-worker.c`: real POSIX worker with signal handling and orphan prevention (`PR_SET_PDEATHSIG`).
2. `src/posix-executor.c` / `include/posix-executor.h`: real process executor implementing `SchedulerExecutor` interface.
3. `src/memk-dispatch.c`: real Linux process dispatcher executable.
4. `tests/linux-mode-tests.c`: automated verification of process lifecycle, signals, no zombies in `/proc`, no orphans, and event sequence parity with VirtualExecutor on the assignment workload.
