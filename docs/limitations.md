# Project Limitations & Boundary Register

In accordance with Master Build Prompt v3 Rule 6, all engineering boundaries, intentional non-goals, and environmental constraints are documented honestly herein.

---

## 1. Environment Constraints

- **WSL1 Unsupported for Linux Mode**:
  - The Linux POSIX mode relies on real Linux kernel signal propagation (`SIGTSTP`, `SIGCONT`, `SIGINT`), process state tracking via `/proc/<pid>/stat`, and parent-death signal configuration (`prctl(PR_SET_PDEATHSIG, SIGKILL)`).
  - WSL1 does not provide full Linux kernel system call emulation for `PDEATHSIG` and procfs state tracking. WSL2 (or native Linux) is required for POSIX dispatcher execution.
- **Valgrind on WSL2**:
  - Valgrind may not be installed by default on all lightweight WSL2 instances. In environments without Valgrind, AddressSanitizer (`-fsanitize=address`) and UndefinedBehaviorSanitizer (`-fsanitize=undefined`) serve as the primary automated memory safety and leak detection barriers.

---

## 2. Academic & Architectural Boundaries

- **Single Arena vs Multi-Arena**:
  - The core simulation operates on a single 1024 MB arena context. In the Royal Strategy Room, multi-policy comparison runs 4 independent, isolated Arena instances within the C engine (`compare.run`), avoiding global state mutation (Decision D2).
- **Variable Partitioning & Internal Fragmentation**:
  - MEMORY KINGDOM implements variable partitioning without fixed-size paging. Consequently, internal fragmentation is 0 by definition; all fragmentation tracked is external fragmentation.
- **Resource Constraints (ASM-12)**:
  - The four resource columns in the assignment workload (printers, scanners, modems, CDs) are parsed, validated, stored, and displayed in the UI, but do not constrain process scheduling because the assignment specification provides no fixed resource pool capacities.
- **History Rewind vs Live POSIX Dispatching (D6)**:
  - In deterministic simulation mode, stepping backwards (`sim.seek`) restores exact historical memory snapshots. In real Linux POSIX process execution mode, historical snapshots are inspectable, but real completed processes cannot be "un-executed" backwards in time.

