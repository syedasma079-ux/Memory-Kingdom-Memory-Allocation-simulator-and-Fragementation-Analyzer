# MEMORY KINGDOM Architecture Specification

## 1. System Overview

**MEMORY KINGDOM** is a full-stack Operating Systems project that pairs a rigorous C memory management simulation engine and Linux POSIX dispatcher with an authentic 16-bit SNES-style fantasy strategy interface.

```
+-----------------------------------------------------------------------------------+
|                            REACT 18 / VITE FRONTEND                              |
|   (Kingdom Overview, Memory Arena, Algorithm Guild, Process Tavern, Castle,       |
|    Fragmentation Dungeon, Strategy Room, Quests, Chronicles, Settings, /sprites)  |
|                                                                                   |
|   - Event-Sourced Zustand Store (pure snapshots, time-travel cursor)             |
|   - 16-bit Pixel Art Canvas & Sprite Atlas (32-color palette)                    |
|   - Recharts Visualizations & Technical Ruler / Table                             |
+------------------------------------------^----------------------------------------+
                                           | HTTP (REST) & SSE (Server-Sent Events)
                                           v
+-----------------------------------------------------------------------------------+
|                        NODE.JS / EXPRESS API BRIDGE (127.0.0.1:4000)             |
|   - Spawns C Engine child processes (`memk-sim` or `memk-dispatch`)               |
|   - Enforces strict Zod validation, CORS, rate/body limits, session isolation     |
|   - Streams events in real-time over SSE (15s heartbeat, Last-Event-ID resume)    |
|   - D9: Zero allocation recomputation (forwards engine data byte-for-byte)        |
+------------------------------------------^----------------------------------------+
                                           | Bidirectional JSON Lines over pipes
                                           | (stdin: commands, stdout: replies & events)
                                           v
+-----------------------------------------------------------------------------------+
|                         C MEMORY ENGINE CORE (libmemk.a)                          |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | Academic Layer: verbatim `struct mab` & 5 required functions              |   |
|   | (memChk, memAlloc, memFree, memMerge, memSplit)                           |   |
|   +---------------------------------------------------------------------------+   |
|   | Arena Layer: `arenaAlloc`, `arenaFree`, `arenaMerge`, `arenaValidate`      |   |
|   | Pointer Safety: Pre-merge pointer repair, Next Fit circular walk          |   |
|   | Statistics: utilization, externalFragmentation, dragonPower, dragonTier   |   |
|   +---------------------------------------------------------------------------+   |
|   | Scheduler Core: Multi-level feedback queues (Input, UserJob, Q1, Q2, Q3)  |   |
|   | State Machine: NOT_ARRIVED, WAITING_FOR_MEMORY, READY, RUNNING,           |   |
|   |                SUSPENDED, TERMINATED                                      |   |
|   | Tick algorithm boundary ordering (ASM-3)                                  |   |
|   +---------------------------------------------------------------------------+   |
|   | Execution Backends:                                                       |   |
|   | 1. VirtualExecutor: Instant, deterministic simulation                     |   |
|   | 2. PosixExecutor: Real Linux `fork()`, `execv()`, `SIGTSTP`, `SIGCONT`,    |   |
|   |                   `SIGINT`, `waitpid()`, child process reaping            |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown

### 2.1 C Memory Engine (`backend/c-engine/`)
- Compiled with C11 `-std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror`.
- Executables:
  - `memk-sim`: deterministic mode JSON Lines server and CLI dump tool.
  - `memk-dispatch`: Linux POSIX dispatcher that runs real processes.
  - `memk-worker`: isolated child worker receiving real signals (`SIGINT`, `SIGTSTP` $\rightarrow$ `SIGSTOP`, `SIGCONT`).
  - `libmemk.a`: static archive holding the entire core.

### 2.2 Node.js API (`backend/api/`)
- Express 4.x running on `127.0.0.1:4000`.
- Spawns C processes using `child_process.spawn(..., { shell: false })`.
- Handles connection heartbeats, session teardown on client disconnect, and child reaping.

### 2.3 React Frontend (`frontend/`)
- Built with Vite, React 18, TypeScript (strict), and Tailwind CSS.
- Adheres to Decision D9: React is an observer; all statistics, layouts, and offsets come directly from C engine snapshots.

