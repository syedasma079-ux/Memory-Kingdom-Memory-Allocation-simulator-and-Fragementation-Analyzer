CC ?= gcc
CFLAGS ?= -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -O2 -Iinclude
SAN_FLAGS = -std=c11 -D_POSIX_C_SOURCE=200809L -Wall -Wextra -Werror -g -fsanitize=address,undefined -Iinclude
LDFLAGS = -lm

SRC = src/mab.c src/arena.c
OBJ = $(SRC:.c=.o)

all: libmemk.a memk-sim memk-tests

libmemk.a: $(OBJ)
	ar rcs $@ $(OBJ)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

memk-sim: src/memk-sim.o libmemk.a
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

src/memk-sim.o: src/memk-sim.c
	$(CC) $(CFLAGS) -c $< -o $@

memk-tests: tests/memk-tests.c libmemk.a
	$(CC) $(CFLAGS) $^ -o $@ $(LDFLAGS)

memk-tests-san: tests/memk-tests.c $(SRC)
	$(CC) $(SAN_FLAGS) $^ -o $@ $(LDFLAGS)

check: all memk-tests-san
	@echo "=== 1. Normal Build Tests ==="
	./memk-tests
	@echo "=== 2. ASan + UBSan Build Tests ==="
	./memk-tests-san
	@echo "=== 3. Valgrind Check (if installed) ==="
	@if command -v valgrind >/dev/null 2>&1; then \
		valgrind --leak-check=full --error-exitcode=1 ./memk-tests; \
	else \
		echo "valgrind not found, skipping valgrind run (ASan+UBSan passed)"; \
	fi
	@echo "=== 4. G1 Dump Verification ==="
	@printf "Offset | Size | Allocated\n0 | 192 | FALSE\n192 | 32 | TRUE\n224 | 416 | FALSE\n640 | 32 | TRUE\n672 | 160 | FALSE\n832 | 128 | TRUE\n960 | 64 | FALSE\n" > .expected_g1.txt
	@./memk-sim --dataset tests/golden/assignment.txt --policy first_fit --until 6 --dump > .actual_g1_ff.txt
	@diff -u .expected_g1.txt .actual_g1_ff.txt
	@echo "G1 Dump matches exactly for first_fit"
	@./memk-sim --dataset tests/golden/assignment.txt --policy next_fit --until 6 --dump > .actual_g1_nf.txt
	@diff -u .expected_g1.txt .actual_g1_nf.txt
	@echo "G1 Dump matches exactly for next_fit"
	@./memk-sim --dataset tests/golden/assignment.txt --policy best_fit --until 6 --dump > .actual_g1_bf.txt
	@diff -u .expected_g1.txt .actual_g1_bf.txt
	@echo "G1 Dump matches exactly for best_fit"
	@./memk-sim --dataset tests/golden/assignment.txt --policy worst_fit --until 6 --dump > .actual_g1_wf.txt
	@diff -u .expected_g1.txt .actual_g1_wf.txt
	@echo "G1 Dump matches exactly for worst_fit"
	@rm -f .expected_g1.txt .actual_g1_*.txt
	@echo "All Engine Core checks passed successfully."

clean:
	rm -f $(OBJ) src/*.o tests/*.o libmemk.a memk-sim memk-tests memk-tests-san

.PHONY: all check clean
