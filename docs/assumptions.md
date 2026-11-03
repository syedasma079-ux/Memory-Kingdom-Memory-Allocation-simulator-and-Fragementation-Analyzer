# Assumptions Register

Every assumption represents a named runtime option that is configurable and tagged. Per prompt instructions, all assumptions remain `UNVERIFIED` until explicitly verified by the project owner.

| ID | Rule | Default | Golden Dependent? | Status | Effect |
|---|---|---|---|---|---|
| ASM-1 | Demotion trigger: after every full quantum with time left (`always`), or only when another process is ready (`only-if-contended`) | `always` | No (identical under both) | UNVERIFIED | When `always`, a process that has run a full quantum is demoted regardless of whether other processes are queued. |
| ASM-2 | Admission ordering: strict FIFO user job queue with head-of-line blocking (`fifo-block`) or later jobs may bypass a blocked head (`skip-ahead`); same-tick arrivals ordered by PID | `fifo-block` | No (P6, P7, P8 all fit at t=7) | UNVERIFIED | When `fifo-block`, a process at the head of the user job queue that cannot fit blocks subsequent processes until memory frees. |
| ASM-3 | Tick-boundary order: release finished process, then arrivals, then admission, then dispatch | As listed | No (no release coincides with an arrival in dataset) | UNVERIFIED | Deterministic ordering at tick boundaries. |
| ASM-4 | Retry rule: a blocked head is retried only after a memory release or when the head changes; failed attempts counted per attempt, processesDelayed counted per process | As listed | No (affects counters only) | UNVERIFIED | Prevents spurious retry spam when memory hasn't changed. |
| ASM-5 | Queue behavior: priority $p$ enters feedback queue $Q(p)$; FIFO within a queue; demoted process goes to the tail of the next queue down; $Q3$ is round robin; no preemption inside a quantum; no aging | As listed | No | UNVERIFIED | Standard multi-level feedback queue behavior. |
| ASM-6 | Idle handling: with nothing runnable the clock still advances one tick per step and an idle event is emitted | As listed | No | UNVERIFIED | Clock advances monotonically even when no processes run. |
| ASM-7 | State mapping: READY = admitted and never run; SUSPENDED = ran at least once, stopped, waiting in a feedback queue | As listed | No | UNVERIFIED | Clean distinction between freshly admitted and suspended processes. |
| ASM-8 | Next Fit pointer after an exact fit moves to the following block (head if none); after a failure it is unchanged | As listed | No (no exact fit in dataset) | UNVERIFIED | Keeps pointer valid and cyclic across allocations. |
| ASM-9 | A search step is one block examined, allocated blocks included; also report `freeBlocksExamined` | As listed | No (affects metrics only) | UNVERIFIED | Search step metric calculation. |
| ASM-10 | Best Fit and Worst Fit ties go to lowest offset and never exit early | As listed | No (no ties in dataset) | UNVERIFIED | Deterministic tie breaking. |
| ASM-11 | A finishing process releases memory at the end of its final slice (time $t + \text{quantum}$) | As listed | Yes (DER: G1 requires it) | UNVERIFIED | Released when slice concludes. |
| ASM-12 | Resource columns are carried but do not constrain scheduling | Ignored | No (all zero in dataset) | UNVERIFIED | Resource fields parsed and stored for display. |
