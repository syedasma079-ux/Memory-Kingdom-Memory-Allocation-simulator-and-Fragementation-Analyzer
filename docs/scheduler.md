# Multilevel Feedback Scheduler & Linux POSIX Mode

## 1. Queue Architecture

The scheduler models a feedback process execution engine with the following hierarchy:

```
[Input Dispatch List] (arriving jobs sorted by arrival time, then PID)
       │
       ▼ (arrival <= t)
[User Job Queue] (arrived jobs waiting for memory allocation)
       │
       ▼ (arenaAlloc succeeds)
[Feedback Queue Q1] (highest priority, quantum = 1s)
       │ (quantum expired with CPU remaining -> demoted)
       ▼
[Feedback Queue Q2] (medium priority, quantum = 1s)
       │ (quantum expired with CPU remaining -> demoted)
       ▼
[Feedback Queue Q3] (lowest priority, round-robin, quantum = 1s)
       │
       ▼
[Running Slot] (at most one process executing per tick)
```

---

## 2. Process State Machine

Processes transition across six discrete states:
1. `NOT_ARRIVED`: In the Input list; simulated time $t < \text{arrival}$.
2. `WAITING_FOR_MEMORY`: Arrived at head of User Job Queue, but cannot be admitted due to insufficient memory or fragmentation.
3. `READY`: Memory allocated; enqueued in a feedback queue and waiting for CPU.
4. `RUNNING`: Dispatched and executing on the CPU for the current quantum slice $[t, t+\text{quantum})$.
5. `SUSPENDED`: Time slice expired with remaining execution time $> 0$; stopped and moved to the tail of the next priority queue.
6. `TERMINATED`: Remaining burst reached 0; memory deallocated via `arenaFree` and process cleaned up.

---

## 3. Tick Boundary Execution Order (ASM-3)

At each integer tick boundary $t$, operations execute in strict sequential order:
1. **Completion Check**: If a process ran during the previous slice $[t-1, t)$:
   - `remaining -= quantum`.
   - If `remaining <= 0`: mark `TERMINATED`, call `arenaFree(offset)` to release memory and merge adjacent free holes.
   - Else: mark `SUSPENDED`, demote priority by 1 level ($Q_1 \rightarrow Q_2 \rightarrow Q_3$), and append to queue tail.
2. **Arrivals**: Move processes with $\text{arrival} \le t$ into the User Job Queue in PID order.
3. **Admission**: Attempt `arenaAlloc` for the head of the User Job Queue.
   - On success: mark `READY` and enqueue into $Q(\text{priority})$.
   - On failure: emit `alloc_failed`, mark `WAITING_FOR_MEMORY`, and halt admission for this tick (Head-of-Line blocking, ASM-2).
4. **Dispatch**: Select the head of the highest non-empty queue ($Q_1$, then $Q_2$, then $Q_3$) and mark `RUNNING`.

---

## 4. Linux POSIX Dispatcher (`memk-dispatch`)

In Linux POSIX mode, real processes are launched, signaled, and reaped:
- **Process Creation**: Uses `fork()` and `execv()` with the absolute path of `memk-worker`.
- **Preemption & Suspension**: Sends `SIGTSTP` to suspend child process; child executes custom handler calling `raise(SIGSTOP)` to ensure stoppage even in detached/orphaned sessions. Confirmed via `waitpid(pid, &st, WUNTRACED)`.
- **Resumption**: Sends `SIGCONT` to wake child process; confirmed via `waitpid(pid, &st, WCONTINUED)`.
- **Termination**: Sends `SIGINT` to child process; waits with a grace period, falls back to `SIGKILL` if unresponsive, and reaps the child to eliminate zombie processes.
- **Zombie Prevention**: All child exits are immediately acknowledged and reaped via `waitpid`. `/proc/<pid>/stat` checks confirm zero zombies.
- **Orphan Prevention**: Workers execute `prctl(PR_SET_PDEATHSIG, SIGKILL)`. If the parent dispatcher dies unexpectedly, the Linux kernel terminates workers instantly.
- **Target PID Safety**: Dispatcher signals are strictly restricted to owned child PIDs (`pid > 1`); negative PIDs, 0, and PID 1 are rejected.

