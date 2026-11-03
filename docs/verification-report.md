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
rm -f src/mab.o src/arena.o src/*.o tests/*.o libmemk.a memk-sim memk-tests memk-tests-san
make: Leaving directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
make: Entering directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/mab.c -o src/mab.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/arena.c -o src/arena.o
ar rcs libmemk.a src/mab.o src/arena.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/memk-sim.c -o src/memk-sim.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude src/memk-sim.o libmemk.a -o memk-sim -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/memk-tests.c libmemk.a -o memk-tests -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/memk-tests.c src/mab.c src/arena.c -o memk-tests-san -lm
=== 1. Normal Build Tests ===
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
=== 3. Valgrind Check (if installed) ===
valgrind not found, skipping valgrind run (ASan+UBSan passed)
=== 4. G1 Dump Verification ===
G1 Dump matches exactly for first_fit
G1 Dump matches exactly for next_fit
G1 Dump matches exactly for best_fit
G1 Dump matches exactly for worst_fit
All Engine Core checks passed successfully.
make: Leaving directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
==========================================
 ALL VERIFICATION CHECKS PASSED           
==========================================
```

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
rm -f src/mab.o src/arena.o src/scheduler.o src/protocol.o src/*.o tests/*.o libmemk.a memk-sim memk-tests memk-tests-san scheduler-tests scheduler-tests-san protocol-fuzz protocol-fuzz-san
make: Leaving directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
make: Entering directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/mab.c -o src/mab.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/arena.c -o src/arena.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/scheduler.c -o src/scheduler.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/protocol.c -o src/protocol.o
ar rcs libmemk.a src/mab.o src/arena.o src/scheduler.o src/protocol.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude -c src/memk-sim.c -o src/memk-sim.o
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude src/memk-sim.o libmemk.a -o memk-sim -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/memk-tests.c libmemk.a -o memk-tests -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/scheduler-tests.c libmemk.a -o scheduler-tests -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude tests/protocol-fuzz.c libmemk.a -o protocol-fuzz -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/memk-tests.c src/mab.c src/arena.c src/scheduler.c src/protocol.c -o memk-tests-san -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/scheduler-tests.c src/mab.c src/arena.c src/scheduler.c src/protocol.c -o scheduler-tests-san -lm
cc -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude tests/protocol-fuzz.c src/mab.c src/arena.c src/scheduler.c src/protocol.c -o protocol-fuzz-san -lm
=== 1. Normal Build Engine & Scheduler Tests ===
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
=== 3. Valgrind Check (if installed) ===
valgrind not found, skipping valgrind run (ASan+UBSan passed)
=== 4. G1 Dump Verification ===
G1 Dump matches exactly for first_fit
G1 Dump matches exactly for next_fit
G1 Dump matches exactly for best_fit
G1 Dump matches exactly for worst_fit
All Phase 1 and Phase 2 checks passed successfully.
make: Leaving directory '/home/ramita/projects/memory-kingdom/backend/c-engine'
==========================================
 ALL VERIFICATION CHECKS PASSED           
==========================================
```

### Gate 2 Status: PASSED
