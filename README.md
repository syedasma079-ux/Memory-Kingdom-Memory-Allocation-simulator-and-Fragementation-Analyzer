# MEMORY KINGDOM

*Every process needs a home. Every memory block tells a story.*

**MEMORY KINGDOM** is a full-stack Operating Systems dynamic memory allocation simulator, process dispatcher, and fragmentation laboratory presented as an authentic 16-bit SNES-style fantasy strategy game.

A 1024 MB physical memory arena represents an ancient realm. Incoming processes are adventurers seeking plots of land. Four allocation guilds govern their settlements:
- **Swift Rangers** (First Fit)
- **Wandering Knights** (Next Fit)
- **Precision Architects** (Best Fit)
- **Giant Keepers** (Worst Fit)

As adventurers complete their quests and vacate settlements, disjointed free holes awaken the fearsome **Dragon of Fragmentation**.

---

## 1. Architecture Overview

The C memory engine is the single source of truth (Decision D9). Node.js and React never calculate allocations, splits, merges, or fragmentation statistics.

```
┌────────────────────────────────────────────────────────┐
│               REACT 18 + VITE FRONTEND                 │
│  (10 Locations · Pure Snapshots · 16-Bit Pixel Art)    │
└───────────────────────────▲────────────────────────────┘
                            │ REST & SSE Events
┌───────────────────────────▼────────────────────────────┐
│              NODE.JS / EXPRESS API BRIDGE              │
│       (127.0.0.1:4000 · Zod Whitelist · Pipes)         │
└───────────────────────────▲────────────────────────────┘
                            │ JSON Lines over stdin/stdout
┌───────────────────────────▼────────────────────────────┐
│                  C ENGINE CORE (C11)                   │
│   struct mab (exact academic signatures)               │
│   Arena allocator (pre-merge pointer safety)           │
│   Scheduler (Multilevel Feedback Queues)               │
│   Virtual & POSIX Dispatcher (fork/exec/signals)       │
└────────────────────────────────────────────────────────┘
```

---

## 2. Quick Start & Execution (Ubuntu WSL2 / Native Linux)

### Setup & One-Command Launch
```bash
# 1. Install prerequisites & packages
npm run setup

# 2. Build everything (C engine, Express API, React frontend)
npm run build

# 3. Run all verification tests (Phases 1 through 7)
npm test

# 4. Start both API and Frontend
npm run dev
# Or via make:
make run
```

Access the application in your browser:
- **Game Interface**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://127.0.0.1:4000/api/health](http://127.0.0.1:4000/api/health)

*(Note for Windows WSL2 users: WSL2 forwards localhost ports automatically to Windows.)*

---

## 3. Academic Requirements & Golden Test Values

### Academic Memory Allocation Primitives
Preserved verbatim in [`backend/c-engine/include/mab.h`](file:///backend/c-engine/include/mab.h):
- `MabPtr memChk(MabPtr m, int size);`
- `MabPtr memAlloc(MabPtr m, int size);`
- `MabPtr memFree(MabPtr m);`
- `MabPtr memMerge(MabPtr m);`
- `MabPtr memSplit(MabPtr m, int size);`

### Locked Golden Test Verification (G1, G2, G3)
Fixtures are strictly locked under the git tag `golden-lock` in `backend/c-engine/tests/golden/`.

- **G1 (Layout at $t=6$)**:
  All 4 policies produce identical layouts because initial allocations consume a single free tail block:
  - Offset 0 (192 MB, Free)
  - Offset 192 (32 MB, Allocated - P1)
  - Offset 224 (416 MB, Free)
  - Offset 640 (32 MB, Allocated - P3)
  - Offset 672 (160 MB, Free)
  - Offset 832 (128 MB, Allocated - P5)
  - Offset 960 (64 MB, Free)
  - Next Fit pointer = Offset 960.

- **G2 (Allocation Offsets for P6, P7, P8 at $t=7$)**:
  | Policy | P6 Offset | P7 Offset | P8 Offset | Next Fit Pointer |
  | :--- | :---: | :---: | :---: | :---: |
  | **First Fit** | 0 | 224 | 108 | 960 |
  | **Next Fit** | 0 | 224 | 480 | 560 |
  | **Best Fit** | 672 | 224 | 480 | 960 |
  | **Worst Fit** | 224 | 332 | 0 | 960 |

- **G3 (Derived Statistics at $t=7$)**:
  - Total Free = 388 MB across all four policies.
  - Largest Free = 160 MB (First Fit, Next Fit, Worst Fit) / 192 MB (Best Fit).
  - External Fragmentation = 58.76% (First Fit, Next Fit, Worst Fit) / 50.52% (Best Fit).

---

## 4. Kingdom Locations (10 Destinations)

1. **Kingdom Overview**: Realm status, active process count, mini-map, and cinematic landing scene.
2. **Memory Arena**: 8 rows of 128 MB proportional grid, WORLD and TECHNICAL modes, manual sandbox allocator.
3. **Algorithm Guild**: Swift Rangers, Wandering Knights, Precision Architects, Giant Keepers.
4. **Process Tavern**: Adventurer lineup, state indicators, and workload generators.
5. **Feedback Castle**: Multi-level queues (Input, User Job, Q1, Q2, Q3) and Virtual/POSIX execution toggle.
6. **Fragmentation Dungeon**: Dragon of Fragmentation with 5 visual tiers and lava fissures scaling with cracks.
7. **Royal Strategy Room**: Side-by-side four-policy simulation with comparative Recharts.
8. **Quest Board**: 6 solvable memory challenges with scripted test coverage.
9. **Simulation Chronicles**: Full event log and report exporter (JSON, Markdown, CSV).
10. **System Settings**: Playback pacing, quantum, and runtime assumption controls.
11. **Sprite Atlas (Dev)** (`/sprites`): Interactive 16-bit SNES sprite asset viewer.

---

## 5. Scheduler Assumptions (ASM-1 to ASM-12)

All 12 assumptions are configurable at runtime and marked as **UNVERIFIED** until confirmed:
- **ASM-1**: Demotion trigger (default: `always`)
- **ASM-2**: Admission ordering (default: `fifo-block` with head-of-line blocking)
- **ASM-3**: Tick boundary execution order (release $\rightarrow$ arrivals $\rightarrow$ admission $\rightarrow$ dispatch)
- **ASM-4**: Blocked head retry rule (retried upon memory release)
- **ASM-5**: Multilevel feedback queue demotion ($Q_1 \rightarrow Q_2 \rightarrow Q_3$)
- **ASM-6**: Idle clock advance (clock ticks advance when no process runnable)
- **ASM-7**: State mapping (`READY` = admitted & unrun; `SUSPENDED` = pre-empted)
- **ASM-8**: Next Fit pointer start rule (search begins AT pointed block, circular wrap)
- **ASM-9**: Search step counting (every block examined counts as a step)
- **ASM-10**: Best/Worst Fit tie-breaking (ties go to lowest offset)
- **ASM-11**: Release timing (memory released at end of final slice $t + \text{quantum}$)
- **ASM-12**: Resource columns (printers/scanners/modems/CDs displayed; zero in assignment)

---

## 6. Verification Suite

Run the complete verification pipeline with a single command:
```bash
./scripts/verify.sh
```

Verifies:
1. `golden-lock` fixture integrity.
2. Single source of truth enforcement (`scripts/check-single-source.sh`).
3. C Engine Core (`memk-tests` normal + ASan/UBSan, pointer safety suite, G1–G3).
4. Scheduler Core & Fuzzing (`scheduler-tests`, `protocol-fuzz` with 500 cases).
5. Linux POSIX Dispatcher (`linux-mode-tests` signals, 0 zombies, PDEATHSIG orphans).
6. Node.js Express API (`api.test.ts`, `phase5.test.ts`, HTTP G1–G3 driver).
7. React Frontend (`tsc`, `vite build`, 26 unit and navigation tests).

