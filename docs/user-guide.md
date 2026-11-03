# MEMORY KINGDOM User Guide

Welcome to **MEMORY KINGDOM**, the visual dynamic memory allocator and fragmentation laboratory.

---

## 1. Getting Started

### Prerequisites (Ubuntu WSL2 / Native Linux)
- GCC $\ge 11$, Make $\ge 4.3$
- Node.js $\ge 20$, npm $\ge 10$

### Setup & Launch
```bash
# 1. Check prerequisites and install packages
npm run setup

# 2. Compile everything and run all verification tests
npm run build
npm test

# 3. Launch both API and Frontend
npm run dev
```
Open your browser to:
- **Game UI**: `http://localhost:5173`
- **Backend API**: `http://127.0.0.1:4000/api/health`

---

## 2. Navigating the Realm (10 Locations)

1. **Kingdom Overview**: Realm dashboard, live realm statistics, mini-map, active adventurers counter, and cinematic landing scene.
2. **Memory Arena**: The core 1024 MB realm map divided into 8 rows of 128 MB:
   - **WORLD Mode**: Proportional pixel-art terrain, process settlement buildings, flags, and deterministic decorations.
   - **TECHNICAL Mode**: Pixel-perfect offset ruler, full block metrics table, Next Fit pointer indicator, and live linked-list visualization.
   - **Sandbox Controls**: Manually request or free memory blocks directly from the C engine.
3. **Algorithm Guild**: Compare the four ancient guilds: Swift Rangers (First Fit), Precision Architects (Best Fit), Wandering Knights (Next Fit), and Giant Keepers (Worst Fit). Select your policy before tick 0.
4. **Process Tavern**: Adventurer lineup. View arriving processes, CPU bursts, memory requirements, and states. Load the assignment dataset or generate seeded random workloads.
5. **Feedback Queue Castle**: Real-time visualization of the Input list, User Job Queue, Q1, Q2, Q3, and the active execution slot. Toggle between Virtual and Linux POSIX dispatcher modes.
6. **Fragmentation Dungeon**: The lair of the Dragon of Fragmentation. Watch the dragon evolve across 5 visual power tiers as external fragmentation rises, with ground fissures scaling with `cracks`.
7. **Royal Strategy Room**: Side-by-side multi-arena simulation comparing all four allocation policies simultaneously on the exact same workload. View radar/bar charts, search steps, and turnaround times.
8. **Quest Board**: Interactive challenges (Q1–Q6) covering basic allocation, neighbor merging, First Fit prediction, failure analysis, persistent pointer traversal, and dragon pacification.
9. **Simulation Chronicles**: Complete searchable event log recording every arrival, allocation, search step, split, execution tick, and merge. Export simulation reports as JSON, Markdown, or CSV.
10. **System Settings**: Configure simulation playback speed (1x/2x/4x), quantum, reduced-motion accessibility, colorblind contrast, and inspect the 12 scheduler assumptions.
11. **Sprite Atlas (Dev)** (`/sprites`): Dedicated sprite gallery inspecting every 16-bit SNES sprite asset, animation frame, and the 32-color fixed palette.

---

## 3. Time Controls & Playback
- **Play / Pause**: Advance the realm clock continuously.
- **Step Tick**: Advance simulation time by exactly 1 quantum second ($t \rightarrow t+1$).
- **Reset**: Revert the arena and scheduler back to tick 0.
- **Speed Slider**: Accelerate playback at 1x (1000ms), 2x (500ms), or 4x (250ms).
- **Time Scrubber**: Scrub backwards through recorded snapshots for read-only historical inspection.
