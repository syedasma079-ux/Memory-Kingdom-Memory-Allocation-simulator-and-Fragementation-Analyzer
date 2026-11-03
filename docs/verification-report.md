# MEMORY KINGDOM Verification Report

This report records the actual command executions and test outputs at each phase gate.

---

## Phase 1: Engine Core

### Gate Requirements:
1. Golden fixtures copied and committed with `golden-lock` tag.
2. `make check` green under normal and ASan+UBSan builds.
3. G1, G2, G3 pass for all four policies (First Fit, Next Fit, Best Fit, Worst Fit).
4. Next Fit pointer-safety suite passes (all 9 cases).
5. G1 dump matches exactly for all policies.
6. Single-source-of-truth check (`scripts/check-single-source.sh`) passes.

### Gate 1 Status: PASSED

---

## Phase 2: Scheduler Core and Virtual Executor

### Gate Requirements:
1. Tick algorithm, queues (Input, User Job, Q1, Q2, Q3, Running slot), and states implemented.
2. Every assumption ASM-1 to ASM-12 configurable as runtime options.
3. Scheduler tests pass under all combinations of ASM-1 and ASM-2 values.
4. G1 to G3 reproduced through scheduler and protocol for all four policies.
5. Head-of-line blocking (ASM-2) and multilevel priority demotion (ASM-1, ASM-5) verified.
6. Full JSON Lines protocol (`session.configure`, `workload.load`, `workload.assignment`, `workload.random`, `sim.tick`, `sim.run`, `sim.reset`, `snapshot.get`, `arena.alloc`, `arena.free`, `compare.run`).
7. Protocol fuzzer (static malformed and randomized ASCII cases) passes without crashes.
8. `make check` passes under Normal and `ASan + UBSan` builds.
9. Golden fixtures confirmed untouched against `golden-lock`.

### Gate 2 Status: PASSED

---

## Phase 3: Linux Mode (POSIX Dispatcher & Worker)

### Gate Requirements:
1. `memk-worker` process executable:
   - Handles `SIGINT` (clean exit 0).
   - Installs `SIGTSTP` handler that calls `raise(SIGSTOP)` to ensure stoppage even in non-interactive / orphaned process groups.
   - Prevents orphaned processes via `prctl(PR_SET_PDEATHSIG, SIGKILL)` and `getppid() == 1` checks.
2. `PosixExecutor` implementation (`src/posix-executor.c`, `include/posix-executor.h`):
   - Real `fork()` and `execv()` using absolute worker binary path.
   - Signals: `SIGTSTP` to suspend running process, `SIGCONT` to resume, `SIGINT` to terminate.
   - Grace period wait and force `SIGKILL` reaping to ensure zero zombies remain.
   - Signal protection: signals sent strictly to owned child PIDs (`pid > 1`), never to 0, -1, or unrelated PIDs.
3. `linux-mode-tests`:
   - `test_real_signal_sequence`: passes (running $\rightarrow$ `SIGTSTP` stopped $\rightarrow$ `SIGCONT` resumed $\rightarrow$ `SIGINT` reaped).
   - `test_zombie_prevention`: passes (inspects `/proc` confirming 0 zombies).
   - `test_unrelated_pid_protection`: passes (refuses to signal unowned or invalid PIDs).
   - `test_orphan_prevention`: passes (parent dispatcher killed with `SIGKILL` mid-run triggers immediate kernel-level termination of child worker via `PDEATHSIG`).
   - `test_posix_virtual_parity`: passes (exact event sequence, process offsets, states, and arena layout parity with `VirtualExecutor` on assignment dataset).
4. `make check` passes under Normal and `ASan + UBSan` builds.

### Verification Run Output:

```
==========================================
 MEMORY KINGDOM: Global Verification Suite
==========================================
>>> 1. Verifying golden files against golden-lock...
Golden lock check: PASSED (fixtures untouched)
>>> 2. Single-source-of-truth verification...
=== Running Single Source of Truth Checks ===
Single source of truth checks PASSED.
>>> 3. Compiling and verifying C Engine Core...
make: Entering directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
rm -f src/mab.o src/arena.o src/scheduler.o src/protocol.o src/posix-executor.o src/*.o tests/*.o libmemk.a memk-worker memk-dispatch memk-sim memk-tests memk-tests-san scheduler-tests scheduler-tests-san protocol-fuzz protocol-fuzz-san linux-mode-tests linux-mode-tests-san
make: Leaving directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
make: Entering directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/mab.c -o src/mab.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/arena.c -o src/arena.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/scheduler.c -o src/scheduler.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/protocol.c -o src/protocol.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/posix-executor.c -o src/posix-executor.o
ar rcs libmemk.a src/mab.o src/arena.o src/scheduler.o src/protocol.o src/posix-executor.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude src/memk-worker.c -o memk-worker
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/memk-dispatch.c -o src/memk-dispatch.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude src/memk-dispatch.o libmemk.a -o memk-dispatch -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/memk-sim.c -o src/memk-sim.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude src/memk-sim.o libmemk.a -o memk-sim -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/memk-tests.c libmemk.a -o memk-tests -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/scheduler-tests.c libmemk.a -o scheduler-tests -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/protocol-fuzz.c libmemk.a -o protocol-fuzz -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/linux-mode-tests.c libmemk.a -o linux-mode-tests -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/memk-tests.c src/mab.c src/arena.c src/scheduler.c src/protocol.c src/posix-executor.c -o memk-tests-san -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/scheduler-tests.c src/mab.c src/arena.c src/scheduler.c src/protocol.c src/posix-executor.c -o scheduler-tests-san -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/protocol-fuzz.c src/mab.c src/arena.c src/scheduler.c src/protocol.c src/posix-executor.c -o protocol-fuzz-san -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/linux-mode-tests.c src/mab.c src/arena.c src/scheduler.c src/protocol.c src/posix-executor.c -o linux-mode-tests-san -lm
=== 1. Normal Build Engine & Scheduler & Linux Mode Tests ===
./memk-tests
===========================================
 MEMORY KINGDOM: Engine Core Test Suite    
===========================================
Running test_mab_primitives... PASS
Running test_pointer_safety_suite... PASS
Running test_invariants_and_failures... PASS
Running test_golden_g1... PASS
Running test_golden_g2_and_g3... PASS
Running test_seeded_fuzz... PASS
===========================================
Results: 6/6 tests passed.
===========================================
./scheduler-tests
===========================================
 MEMORY KINGDOM: Scheduler Core Test Suite 
===========================================
Running test_scheduler_queue_demotion... PASS
Running test_head_of_line_blocking... PASS
Running test_golden_under_asm_options... PASS
Running test_protocol_line_execution... PASS
===========================================
Results: 4/4 tests passed.
===========================================
./protocol-fuzz
===========================================
 MEMORY KINGDOM: Protocol Fuzzer           
===========================================
Static malformed cases (20): PASSED without crash
Randomized ASCII fuzzing (500 iterations): PASSED without crash
===========================================
Protocol Fuzzer: ALL CHECKS PASSED
===========================================
./linux-mode-tests
===========================================
 MEMORY KINGDOM: Linux Mode Test Suite     
===========================================
Running test_real_signal_sequence... PASS
Running test_zombie_prevention... PASS
Running test_unrelated_pid_protection... PASS
Running test_orphan_prevention... PASS
Running test_posix_virtual_parity... PASS
===========================================
Results: 5/5 tests passed.
===========================================
=== 2. ASan + UBSan Build Tests ===
./memk-tests-san
===========================================
 MEMORY KINGDOM: Engine Core Test Suite    
===========================================
Running test_mab_primitives... PASS
Running test_pointer_safety_suite... PASS
Running test_invariants_and_failures... PASS
Running test_golden_g1... PASS
Running test_golden_g2_and_g3... PASS
Running test_seeded_fuzz... PASS
===========================================
Results: 6/6 tests passed.
===========================================
./scheduler-tests-san
===========================================
 MEMORY KINGDOM: Scheduler Core Test Suite 
===========================================
Running test_scheduler_queue_demotion... PASS
Running test_head_of_line_blocking... PASS
Running test_golden_under_asm_options... PASS
Running test_protocol_line_execution... PASS
===========================================
Results: 4/4 tests passed.
===========================================
./protocol-fuzz-san
===========================================
 MEMORY KINGDOM: Protocol Fuzzer           
===========================================
Static malformed cases (20): PASSED without crash
Randomized ASCII fuzzing (500 iterations): PASSED without crash
===========================================
Protocol Fuzzer: ALL CHECKS PASSED
===========================================
./linux-mode-tests-san
===========================================
 MEMORY KINGDOM: Linux Mode Test Suite     
===========================================
Running test_real_signal_sequence... PASS
Running test_zombie_prevention... PASS
Running test_unrelated_pid_protection... PASS
Running test_orphan_prevention... PASS
Running test_posix_virtual_parity... PASS
===========================================
Results: 5/5 tests passed.
===========================================
=== 3. Valgrind Check (if installed) ===
valgrind not found, skipping valgrind run (ASan+UBSan passed)
=== 4. G1 Dump Verification ===
G1 Dump matches exactly for first_fit
G1 Dump matches exactly for next_fit
G1 Dump matches exactly for best_fit
G1 Dump matches exactly for worst_fit
All Phase 1, Phase 2, and Phase 3 checks passed successfully.
make: Leaving directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
==========================================
 ALL VERIFICATION CHECKS PASSED           
==========================================
```

### Gate 3 Status: PASSED
