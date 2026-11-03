# MEMORY KINGDOM Project Status

## Current Phase: Phase 6 (Game Layer)

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
- [x] **Phase 5: Functional Frontend (10 Interactive Locations, Store, Pure Snapshots)** - **PASSED**
  - Vite + React + TypeScript + Tailwind CSS
  - Event-sourced Zustand store: pure snapshots from C engine, time-travel cursor, playback controls
  - Pure proportional 2D realm mapping: `layoutBlocks(blocks, total)` (8 rows of 128 MB)
  - All 10 locations fully functional and tested:
    1. Kingdom Overview (realm summary, live mini-map, dragon threat preview, queue counters)
    2. Memory Arena (proportional grid, pointer indicators, tooltips, offset ruler)
    3. Algorithm Guild (First Fit, Next Fit, Best Fit, Worst Fit live comparative display)
    4. Process Tavern (adventurers table with state badges, remaining bursts, memory requirements)
    5. Feedback Castle (queues: Input, UserJob, Q1, Q2, Q3, running slot)
    6. Fragmentation Dungeon (Dragon of Fragmentation: tier, power, cracks, free block stats)
    7. Strategy Room (comparative radar/bar charts, side-by-side mid-run views)
    8. Quest Board (4 interactive quests Q1-Q4 with presets loaded into C engine)
    9. Chronicles (event log, filters, CSV/MD/JSON export)
    10. System Settings (speed slider, step/run/reset, assumption toggles ASM-1 to ASM-12 clearly marked UNVERIFIED by default)
  - Single-source-of-truth verified: zero recomputed allocation/split/merge logic in frontend
  - Navigation integration test visiting all 10 locations passed
  - API integration test verifying live G1 ($t=6$) and G2/G3 ($t=7$) passthrough passed
  - Frontend TypeScript compile and Vite bundle passed with 0 errors
- [ ] **Phase 6: Game Layer (16-bit SNES Pixel Art, Dragon Tiers, Solvable Quests)**
- [ ] **Phase 7: Final Verification & Clean WSL2 Run**

### Next Steps
Begin Phase 6: Game Layer:
1. Refine 16-bit SNES pixel art styling across all 10 locations.
2. Complete Dragon of Fragmentation visuals and audio cues / animations per tier.
3. Validate and polish all 4 quest scenarios with clear victory conditions and solver checks.
