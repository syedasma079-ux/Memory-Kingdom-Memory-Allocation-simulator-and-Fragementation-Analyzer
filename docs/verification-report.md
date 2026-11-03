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
