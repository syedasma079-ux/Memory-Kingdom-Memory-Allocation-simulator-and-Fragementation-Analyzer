# MEMORY KINGDOM Project Status

## Current Phase: Phase 5 (Functional Frontend)

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
- [x] **Phase 4: API (Walking Skeleton End-to-End)** - **PASSED**
  - Express server (Node 20+, TypeScript, Zod) on `127.0.0.1:4000`
  - Spawns C engine `memk-sim` / `memk-dispatch` over JSON Lines pipes
  - Server-Sent Events (SSE) with `Last-Event-ID` resume and 15s heartbeats
  - Full REST endpoints: sessions, commands, snapshots, reports (`json|md|csv`), 4-policy comparison, assignment dataset
  - Passthrough tests confirm zero allocation/split/merge recomputation in Node
  - Automated thin script (`scripts/drive-assignment.ts`) drives dataset through HTTP and reproduces G1, G2, G3
- [ ] **Phase 5: Functional Frontend (10 Interactive Locations, Store, Pure Snapshots)**
  - Vite + React + TypeScript + Tailwind
  - Event-sourced store: snapshots, cursor, pure views
  - `layoutBlocks(blocks, total)` proportional 2D realm mapping (8 rows of 128 MB)
  - Technical view (offset ruler, linked-list diagram, process table)
  - All 10 locations functional: Kingdom Overview, Memory Arena, Algorithm Guild, Process Tavern, Feedback Queue Castle, Fragmentation Dungeon, Royal Strategy Room, Quest Board, Simulation Chronicles, System Settings
  - Navigation test visiting all 10 locations
- [ ] **Phase 6: Game Layer (16-bit SNES Pixel Art, Dragon Tiers, Solvable Quests)**
- [ ] **Phase 7: Final Verification & Clean WSL2 Run**

### Next Steps
Begin Phase 5:
1. Initialize `frontend/` with Vite, React, TypeScript, Tailwind CSS, Lucide React, and Recharts.
2. Implement pure proportional layout: `layoutBlocks(blocks, total)`.
3. Implement event-sourced Zustand store rendering pure snapshots from engine.
4. Implement all 10 locations and navigation router.
5. Add frontend unit and navigation tests.
