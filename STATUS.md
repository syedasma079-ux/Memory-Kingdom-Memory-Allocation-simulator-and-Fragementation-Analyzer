# MEMORY KINGDOM Project Status

## Current Phase: Phase 2 (Scheduler Core and Virtual Executor)

### Phase Gates Progress
- [x] **Phase 1: Engine Core** - **PASSED**
  - C memory functions (`mab.c`, `arena.c`, policies, invariants, statistics)
  - Golden fixtures tagged (`golden-lock`)
  - `memk-tests` passing under normal & ASan+UBSan builds
  - Golden tests G1, G2, G3 passing for all 4 policies
  - Next Fit pointer safety suite passing (all 9 cases)
  - `memk-sim --dataset assignment --policy <p> --until 6 --dump` matches G1
  - Single source of truth checks passing
- [ ] **Phase 2: Scheduler Core and Virtual Executor**
  - Tick algorithm, queues, events, snapshots, per-tick statistics
  - Compare across four arenas (Royal Strategy Room)
  - Full JSON Lines protocol (`{id, cmd, args}`, replies, events)
  - Every assumption ASM-1 to ASM-12 as runtime options
  - Protocol fuzzer
- [ ] **Phase 3: Linux Mode (POSIX Dispatcher & Worker)**
- [ ] **Phase 4: API (Node/Express, SSE, Single Source of Truth)**
- [ ] **Phase 5: Functional Frontend (10 Interactive Locations, Store, Pure Snapshots)**
- [ ] **Phase 6: Game Layer (16-bit SNES Pixel Art, Dragon Tiers, Solvable Quests)**
- [ ] **Phase 7: Final Verification & Clean WSL2 Run**

### Next Steps
Begin Phase 2:
1. Implement scheduler core:
   - Queues: Input list -> User Job Queue -> Feedback Q1, Q2, Q3 -> Running slot
   - Process states: NOT_ARRIVED, WAITING_FOR_MEMORY, READY, RUNNING, SUSPENDED, TERMINATED
   - Step order: 1 (previous slice finish/demote), 2 (arrivals), 3 (admission), 4 (dispatch)
   - Configurable options for all ASM rules
2. Implement Virtual Executor & Event Emitter
3. Implement JSON Lines server protocol in `memk-sim`
4. Add protocol test suite and fuzzing
