# MEMORY KINGDOM Project Status

## Current Phase: Phase 7 (Final Verification & Clean WSL2 Run)

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
  - All 10 locations fully functional and tested
  - Single-source-of-truth verified: zero recomputed allocation/split/merge logic in frontend
  - Navigation integration test visiting all 10 locations passed
  - API integration test verifying live G1 ($t=6$) and G2/G3 ($t=7$) passthrough passed
  - Frontend TypeScript compile and Vite bundle passed with 0 errors
- [x] **Phase 6: Game Layer (16-bit SNES Pixel Art, Dragon Tiers, Solvable Quests)** - **PASSED**
  - Strict 32-color fixed palette across 8 ramps (ink, grass, water, stone, earth, gold, ember, magic)
  - In-repo pixel art sprite pipeline: character grids compiled into offscreen canvases (`spriteData.ts`, `spriteAtlas.ts`)
  - All required sprite sets: terrain, territory, adventurer classes (warrior, mage, rogue, cleric), guild themes, dungeon elements
  - Dragon of Fragmentation: 5 visual power tiers (Sleeping, Stirring, Awake, Enraged, Inferno) driven directly by engine stats
  - Cinematic Landing Scene (480x270 internal resolution, castle, river, forest, coiled dragon on tower, skippable $\le$ 1.2s enter transition)
  - Dedicated `/sprites` developer inspection page with category filters and scaling
  - Deterministic decorative placement on memory territories (hash of offset and size)
  - All 6 quests (Q1 to Q6) verified solvable with scripted command sequence unit tests
  - Reduced-motion accessibility supported throughout
- [ ] **Phase 7: Final Verification & Clean WSL2 Run**

### Next Steps
Begin Phase 7: Final Verification & Clean WSL2 Run:
1. Complete final documentation updates in `README.md`, `docs/architecture.md`, `docs/algorithms.md`, `docs/memory-management.md`, `docs/scheduler.md`, `docs/assumptions.md`, `docs/user-guide.md`, `docs/decisions.md`, and `docs/limitations.md`.
2. Verify clean clone and build procedures on WSL2 Ubuntu.
3. Ensure Definition of Done criteria are 100% satisfied.
