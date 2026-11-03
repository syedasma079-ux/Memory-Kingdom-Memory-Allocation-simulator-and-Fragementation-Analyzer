#include "mab.h"
#include "arena.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <math.h>

#define COLOR_GREEN "\033[0;32m"
#define COLOR_RED   "\033[0;31m"
#define COLOR_RESET "\033[0m"

static int g_tests_run = 0;
static int g_tests_passed = 0;

#define TEST_ASSERT(cond, msg) do { \
    if (!(cond)) { \
        printf(COLOR_RED "FAIL: %s (line %d): %s\n" COLOR_RESET, __func__, __LINE__, msg); \
        return 0; \
    } \
} while (0)

#define RUN_TEST(fn) do { \
    g_tests_run++; \
    printf("Running %s... ", #fn); \
    if (fn()) { \
        g_tests_passed++; \
        printf(COLOR_GREEN "PASS\n" COLOR_RESET); \
    } else { \
        printf(COLOR_RED "FAILED\n" COLOR_RESET); \
    } \
} while (0)

/* ------------------------------------------------------------- */
/* 1. mab required functions tests                               */
/* ------------------------------------------------------------- */
static int test_mab_primitives(void) {
    Mab head;
    head.offset = 0;
    head.size = 100;
    head.allocated = 0;
    head.prev = NULL;
    head.next = NULL;

    /* memChk */
    TEST_ASSERT(memChk(&head, 50) == &head, "memChk should find free block");
    TEST_ASSERT(memChk(&head, 150) == NULL, "memChk should return NULL when size too large");

    /* memSplit */
    MabPtr res = memSplit(&head, 40);
    TEST_ASSERT(res == &head, "memSplit should return original block");
    TEST_ASSERT(head.size == 40, "head size should be 40");
    TEST_ASSERT(head.next != NULL, "head should have next");
    TEST_ASSERT(head.next->offset == 40, "rem offset should be 40");
    TEST_ASSERT(head.next->size == 60, "rem size should be 60");
    TEST_ASSERT(head.next->prev == &head, "rem prev should be head");
    TEST_ASSERT(!head.next->allocated, "rem should be free");

    /* memFree and memMerge */
    head.allocated = 1;
    MabPtr surviving = memFree(&head);
    TEST_ASSERT(surviving == &head, "surviving should be head");
    TEST_ASSERT(surviving->size == 100, "merged size should be 100");
    TEST_ASSERT(surviving->next == NULL, "next should be NULL");
    TEST_ASSERT(!surviving->allocated, "surviving should be free");

    /* memAlloc on bare list */
    MabPtr allocated = memAlloc(&head, 30);
    TEST_ASSERT(allocated == &head, "allocated should be head");
    TEST_ASSERT(allocated->size == 30, "size should be 30");
    TEST_ASSERT(allocated->allocated == 1, "should be allocated");
    TEST_ASSERT(allocated->next != NULL && allocated->next->size == 70, "remainder should exist");

    /* Clean up allocated remainder */
    free(allocated->next);
    return 1;
}

/* ------------------------------------------------------------- */
/* 2. Pointer safety suite (Section 2.2)                         */
/* ------------------------------------------------------------- */
static int test_pointer_safety_suite(void) {
    Arena a;

    /* Case 1: Pointer on the freed block that merges into its previous neighbor */
    arenaInit(&a, 1024);
    MabPtr b1, b2;
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b1); /* [0, 100] T */
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b2); /* [100, 100] T */
    /* Free b1 so [0, 100] is free */
    arenaFree(&a, 0, NULL);
    /* Now set nextFit explicitly to b2 */
    a.nextFit = b2;
    a.nextFitOffset = b2->offset;
    /* Freeing b2 merges into b1 (previous neighbor). b2 is absorbed. */
    arenaFree(&a, 100, NULL);
    TEST_ASSERT(a.nextFit->offset == 0, "Case 1: nextFit should point to survivor at 0");
    TEST_ASSERT(a.nextFitOffset == 0, "Case 1: nextFitOffset should be 0");
    TEST_ASSERT(arenaValidate(&a), "Case 1: arena should be valid");
    arenaDestroy(&a);

    /* Case 2: Pointer on the absorbed next neighbor */
    arenaInit(&a, 1024);
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b1); /* [0, 100] T */
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b2); /* [100, 100] T */
    /* Free b2 so [100, 100] is free */
    arenaFree(&a, 100, NULL);
    MabPtr freeNext = a.head->next; /* the free block [100, 100] */
    a.nextFit = freeNext;
    a.nextFitOffset = freeNext->offset;
    /* Now free b1 at 0. b1 will absorb freeNext. Next neighbor is absorbed. */
    arenaFree(&a, 0, NULL);
    TEST_ASSERT(a.nextFit->offset == 0, "Case 2: nextFit should point to survivor at 0");
    TEST_ASSERT(a.nextFitOffset == 0, "Case 2: nextFitOffset should be 0");
    TEST_ASSERT(arenaValidate(&a), "Case 2: arena should be valid");
    arenaDestroy(&a);

    /* Case 3: Pointer already on the survivor */
    arenaInit(&a, 1024);
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b1); /* [0, 100] T */
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b2); /* [100, 100] T */
    arenaFree(&a, 0, NULL); /* [0, 100] is free survivor */
    a.nextFit = a.head; /* pointer already on survivor */
    a.nextFitOffset = 0;
    arenaFree(&a, 100, NULL);
    TEST_ASSERT(a.nextFit->offset == 0, "Case 3: nextFit should remain on survivor at 0");
    TEST_ASSERT(arenaValidate(&a), "Case 3: arena should be valid");
    arenaDestroy(&a);

    /* Case 4: Pointer elsewhere (unchanged) */
    arenaInit(&a, 1024);
    MabPtr b3;
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b1); /* [0, 100] T */
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b2); /* [100, 100] T */
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b3); /* [200, 100] T */
    a.nextFit = b3;
    a.nextFitOffset = 200;
    arenaFree(&a, 0, NULL); /* free block at 0 */
    TEST_ASSERT(a.nextFit == b3 && a.nextFitOffset == 200, "Case 4: pointer elsewhere should be unchanged");
    TEST_ASSERT(arenaValidate(&a), "Case 4: arena should be valid");
    arenaDestroy(&a);

    /* Case 5 & 6: Pointer at head and tail */
    arenaInit(&a, 1024);
    arenaAlloc(&a, POLICY_FIRST_FIT, 200, NULL, &b1);
    a.nextFit = a.head;
    a.nextFitOffset = 0;
    TEST_ASSERT(arenaValidate(&a), "Case 5: pointer at head valid");
    MabPtr tail = a.head->next;
    a.nextFit = tail;
    a.nextFitOffset = tail->offset;
    TEST_ASSERT(arenaValidate(&a), "Case 6: pointer at tail valid");
    arenaDestroy(&a);

    /* Case 7: Merge with both neighbors */
    arenaInit(&a, 1024);
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b1); /* 0 */
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b2); /* 100 */
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b3); /* 200 */
    /* Free b1 and b3 */
    arenaFree(&a, 0, NULL);
    arenaFree(&a, 200, NULL);
    /* Now b2 is surrounded by free block [0, 100] and free block [200, 824] */
    a.nextFit = b2;
    a.nextFitOffset = 100;
    arenaFree(&a, 100, NULL);
    TEST_ASSERT(a.head->next == NULL, "Case 7: all blocks should merge into single block");
    TEST_ASSERT(a.head->size == 1024, "Case 7: single block size 1024");
    TEST_ASSERT(a.nextFit == a.head && a.nextFitOffset == 0, "Case 7: nextFit should be head");
    TEST_ASSERT(arenaValidate(&a), "Case 7: arena should be valid");
    arenaDestroy(&a);

    /* Case 8: Double free */
    arenaInit(&a, 1024);
    arenaAlloc(&a, POLICY_FIRST_FIT, 100, NULL, &b1);
    int rc1 = arenaFree(&a, 0, NULL);
    TEST_ASSERT(rc1 == 0, "Case 8: first free succeeds");
    int rc2 = arenaFree(&a, 0, NULL);
    TEST_ASSERT(rc2 != 0, "Case 8: double free must fail");
    TEST_ASSERT(arenaValidate(&a), "Case 8: arena remains valid after double free");
    arenaDestroy(&a);

    /* Case 9: Free unknown offset */
    arenaInit(&a, 1024);
    int rc3 = arenaFree(&a, 555, NULL);
    TEST_ASSERT(rc3 != 0, "Case 9: free unknown offset must fail");
    TEST_ASSERT(arenaValidate(&a), "Case 9: arena remains valid");
    arenaDestroy(&a);

    return 1;
}

/* ------------------------------------------------------------- */
/* 3. Invariants, failures, and wraparound                       */
/* ------------------------------------------------------------- */
static int test_invariants_and_failures(void) {
    Arena a;
    arenaInit(&a, 1024);

    /* Invalid requests */
    MabPtr out;
    TEST_ASSERT(arenaAlloc(&a, POLICY_FIRST_FIT, 0, NULL, &out) == -1, "alloc 0 fails");
    TEST_ASSERT(a.lastFailureReason == FAIL_INVALID_REQUEST, "FAIL_INVALID_REQUEST");
    TEST_ASSERT(arenaAlloc(&a, POLICY_FIRST_FIT, 2000, NULL, &out) == -1, "alloc > total fails");
    TEST_ASSERT(a.lastFailureReason == FAIL_INVALID_REQUEST, "FAIL_INVALID_REQUEST");

    /* Allocate full arena (exact fit) */
    TEST_ASSERT(arenaAlloc(&a, POLICY_FIRST_FIT, 1024, NULL, &out) == 0, "exact fit alloc succeeds");
    TEST_ASSERT(out->offset == 0 && out->size == 1024 && out->allocated == 1, "exact fit properties");
    TEST_ASSERT(a.head->next == NULL, "no remainder on exact fit");

    /* Total free is now 0 */
    TEST_ASSERT(arenaAlloc(&a, POLICY_FIRST_FIT, 10, NULL, &out) == -2, "insufficient total fails");
    TEST_ASSERT(a.lastFailureReason == FAIL_INSUFFICIENT_TOTAL, "FAIL_INSUFFICIENT_TOTAL");

    /* Free full block */
    arenaFree(&a, 0, NULL);
    TEST_ASSERT(a.head->size == 1024 && !a.head->allocated, "freed full arena");

    /* Test NO_CONTIGUOUS_BLOCK (external fragmentation) */
    MabPtr b0, b1, b2, b3;
    arenaAlloc(&a, POLICY_FIRST_FIT, 256, NULL, &b0);
    arenaAlloc(&a, POLICY_FIRST_FIT, 256, NULL, &b1);
    arenaAlloc(&a, POLICY_FIRST_FIT, 256, NULL, &b2);
    arenaAlloc(&a, POLICY_FIRST_FIT, 256, NULL, &b3);
    /* Free b0 (256) and b2 (256). Total free = 512, but max block = 256 */
    arenaFree(&a, 0, NULL);
    arenaFree(&a, 512, NULL);
    TEST_ASSERT(arenaAlloc(&a, POLICY_FIRST_FIT, 300, NULL, &out) == -3, "no contiguous block should fail");
    TEST_ASSERT(a.lastFailureReason == FAIL_NO_CONTIGUOUS_BLOCK, "FAIL_NO_CONTIGUOUS_BLOCK");

    /* Test Next Fit wraparound */
    /* Currently free at 0 (256) and 512 (256). Allocated at 256 (256) and 768 (256). */
    /* Set nextFit to 512 */
    MabPtr node512 = a.head->next->next;
    TEST_ASSERT(node512->offset == 512, "node at 512");
    a.nextFit = node512;
    a.nextFitOffset = 512;
    /* Alloc 200: Next Fit starts at 512, finds it, splits 512 */
    arenaAlloc(&a, POLICY_NEXT_FIT, 200, NULL, &out);
    TEST_ASSERT(out->offset == 512, "Next fit allocated at 512");
    /* Pointer is at remainder 712 */
    TEST_ASSERT(a.nextFitOffset == 712, "Next fit pointer at 712");
    /* Alloc 100: starts at 712 (size 56 < 100) -> 768 (alloc) -> wrap to 0 (size 256 >= 100) -> allocates at 0! */
    arenaAlloc(&a, POLICY_NEXT_FIT, 100, NULL, &out);
    TEST_ASSERT(out->offset == 0, "Next fit wraps to head and allocates at 0");
    TEST_ASSERT(a.nextFitOffset == 100, "Pointer moves to remainder at 100");

    arenaDestroy(&a);
    return 1;
}

/* ------------------------------------------------------------- */
/* 4. Golden Test Verification (G1, G2, G3)                      */
/* ------------------------------------------------------------- */
static int run_assignment_simulation_to_t6(Arena *a, Policy p) {
    arenaInit(a, 1024);
    /* Workload:
       P0: arrival 0, burst 1, mem 192
       P1: arrival 0, burst 3, mem 32
       P2: arrival 0, burst 1, mem 416
       P3: arrival 0, burst 3, mem 32
       P4: arrival 0, burst 1, mem 160
       P5: arrival 0, burst 3, mem 128
    */
    MabPtr out;
    arenaAlloc(a, p, 192, NULL, &out); /* P0 at 0 */
    arenaAlloc(a, p, 32,  NULL, &out); /* P1 at 192 */
    arenaAlloc(a, p, 416, NULL, &out); /* P2 at 224 */
    arenaAlloc(a, p, 32,  NULL, &out); /* P3 at 640 */
    arenaAlloc(a, p, 160, NULL, &out); /* P4 at 672 */
    arenaAlloc(a, p, 128, NULL, &out); /* P5 at 832 */

    /* Dispatch timeline:
       t=0: P0 runs [0, 1), finishes at t=1 -> free P0 (offset 0)
       t=1: P1 runs [1, 2), demoted to Q2
       t=2: P2 runs [2, 3), finishes at t=3 -> free P2 (offset 224)
       t=3: P3 runs [3, 4), demoted to Q2
       t=4: P4 runs [4, 5), finishes at t=5 -> free P4 (offset 672)
       t=5: P5 runs [5, 6), demoted to Q2
       t=6: P1 runs [6, 7), demoted to Q3 (no release)
    */
    arenaFree(a, 0, NULL);   /* P0 freed */
    arenaFree(a, 224, NULL); /* P2 freed */
    arenaFree(a, 672, NULL); /* P4 freed */

    return 1;
}

static int test_golden_g1(void) {
    /* Verify G1 for all 4 policies */
    Policy policies[] = { POLICY_FIRST_FIT, POLICY_NEXT_FIT, POLICY_BEST_FIT, POLICY_WORST_FIT };
    for (int i = 0; i < 4; i++) {
        Arena a;
        run_assignment_simulation_to_t6(&a, policies[i]);

        /* Expected G1 layout at t=6:
           0: 192 F
           192: 32 T
           224: 416 F
           640: 32 T
           672: 160 F
           832: 128 T
           960: 64 F
           Next Fit pointer = 960
        */
        int expOffsets[] = { 0, 192, 224, 640, 672, 832, 960 };
        int expSizes[]   = { 192, 32, 416, 32, 160, 128, 64 };
        int expAlloc[]   = { 0, 1, 0, 1, 0, 1, 0 };

        MabPtr curr = a.head;
        for (int k = 0; k < 7; k++) {
            TEST_ASSERT(curr != NULL, "G1: block exists");
            TEST_ASSERT(curr->offset == expOffsets[k], "G1: offset matches");
            TEST_ASSERT(curr->size == expSizes[k], "G1: size matches");
            TEST_ASSERT(curr->allocated == expAlloc[k], "G1: allocated matches");
            curr = curr->next;
        }
        TEST_ASSERT(curr == NULL, "G1: exactly 7 blocks");
        TEST_ASSERT(a.nextFitOffset == 960, "G1: Next Fit pointer must be at offset 960");

        arenaDestroy(&a);
    }
    return 1;
}

static int test_golden_g2_and_g3(void) {
    /* At t=7: P6 (108 MB), P7 (256 MB), P8 (80 MB) admitted in that order */
    Policy policies[] = { POLICY_FIRST_FIT, POLICY_NEXT_FIT, POLICY_BEST_FIT, POLICY_WORST_FIT };
    int expP6[] = { 0, 0, 672, 224 };
    int expP7[] = { 224, 224, 224, 332 };
    int expP8[] = { 108, 480, 480, 0 };

    for (int i = 0; i < 4; i++) {
        Arena a;
        run_assignment_simulation_to_t6(&a, policies[i]);

        MabPtr p6, p7, p8;
        arenaAlloc(&a, policies[i], 108, NULL, &p6);
        arenaAlloc(&a, policies[i], 256, NULL, &p7);
        arenaAlloc(&a, policies[i], 80,  NULL, &p8);

        /* Check G2 offsets */
        TEST_ASSERT(p6->offset == expP6[i], "G2: P6 offset matches");
        TEST_ASSERT(p7->offset == expP7[i], "G2: P7 offset matches");
        TEST_ASSERT(p8->offset == expP8[i], "G2: P8 offset matches");

        /* Check G3 statistics */
        ArenaStatistics st;
        arenaGetStats(&a, &st);
        TEST_ASSERT(st.free == 388, "G3: Total free must be 388 MB");

        if (policies[i] == POLICY_FIRST_FIT) {
            TEST_ASSERT(st.largestFree == 160, "G3 FF: largestFree 160");
            TEST_ASSERT(fabs(st.externalFragmentation - 58.76) < 0.01, "G3 FF: extFrag 58.76%");
        } else if (policies[i] == POLICY_NEXT_FIT) {
            TEST_ASSERT(a.nextFitOffset == 560, "G3 NF: Next Fit pointer == 560");
            TEST_ASSERT(st.largestFree == 160, "G3 NF: largestFree 160");
            TEST_ASSERT(fabs(st.externalFragmentation - 58.76) < 0.01, "G3 NF: extFrag 58.76%");
        } else if (policies[i] == POLICY_BEST_FIT) {
            TEST_ASSERT(st.largestFree == 192, "G3 BF: largestFree 192");
            TEST_ASSERT(fabs(st.externalFragmentation - 50.52) < 0.01, "G3 BF: extFrag 50.52%");
        } else if (policies[i] == POLICY_WORST_FIT) {
            TEST_ASSERT(st.largestFree == 160, "G3 WF: largestFree 160");
            TEST_ASSERT(fabs(st.externalFragmentation - 58.76) < 0.01, "G3 WF: extFrag 58.76%");
        }

        arenaDestroy(&a);
    }
    return 1;
}

/* ------------------------------------------------------------- */
/* 5. Randomized Fuzz Test against Byte-Map Reference Model      */
/* ------------------------------------------------------------- */
#define ARENA_FUZZ_SIZE 128
#define FUZZ_ITERATIONS 1000

typedef struct {
    char map[ARENA_FUZZ_SIZE]; /* 0 = free, non-zero = pid */
} RefModel;

static void refInit(RefModel *r) {
    memset(r->map, 0, sizeof(r->map));
}

static int refAlloc(RefModel *r, int offset, int size, int pid) {
    for (int i = 0; i < size; i++) {
        if (r->map[offset + i] != 0) return 0; /* collision */
        r->map[offset + i] = (char)pid;
    }
    return 1;
}

static void refFree(RefModel *r, int offset, int size) {
    for (int i = 0; i < size; i++) {
        r->map[offset + i] = 0;
    }
}

static int test_seeded_fuzz(void) {
    Arena a;
    arenaInit(&a, ARENA_FUZZ_SIZE);
    RefModel ref;
    refInit(&ref);

    srand(1337); /* Seeded for determinism */

    typedef struct {
        int offset;
        int size;
        int active;
        int pid;
    } ActiveBlock;

    ActiveBlock blocks[64];
    int activeCount = 0;
    int nextPid = 1;

    for (int iter = 0; iter < FUZZ_ITERATIONS; iter++) {
        int op = rand() % 10;
        if (op < 6 || activeCount == 0) {
            /* Alloc operation */
            Policy p = (Policy)(rand() % 4);
            int size = 1 + (rand() % 32);
            MabPtr out = NULL;
            int rc = arenaAlloc(&a, p, size, NULL, &out);
            if (rc == 0) {
                TEST_ASSERT(out != NULL, "Alloc out non-null on success");
                int pid = nextPid++;
                TEST_ASSERT(refAlloc(&ref, out->offset, out->size, pid), "Ref model check failed");
                blocks[activeCount].offset = out->offset;
                blocks[activeCount].size = out->size;
                blocks[activeCount].active = 1;
                blocks[activeCount].pid = pid;
                activeCount++;
            }
        } else {
            /* Free operation */
            int idx = rand() % activeCount;
            int offset = blocks[idx].offset;
            int size = blocks[idx].size;
            refFree(&ref, offset, size);
            int rc = arenaFree(&a, offset, NULL);
            TEST_ASSERT(rc == 0, "Fuzz free must succeed");
            blocks[idx] = blocks[activeCount - 1];
            activeCount--;
        }

        TEST_ASSERT(arenaValidate(&a), "Fuzz invariant validation failed");
    }

    arenaDestroy(&a);
    return 1;
}

int main(void) {
    printf("===========================================\n");
    printf(" MEMORY KINGDOM: Engine Core Test Suite    \n");
    printf("===========================================\n");

    RUN_TEST(test_mab_primitives);
    RUN_TEST(test_pointer_safety_suite);
    RUN_TEST(test_invariants_and_failures);
    RUN_TEST(test_golden_g1);
    RUN_TEST(test_golden_g2_and_g3);
    RUN_TEST(test_seeded_fuzz);

    printf("===========================================\n");
    printf("Results: %d/%d tests passed.\n", g_tests_passed, g_tests_run);
    printf("===========================================\n");

    return (g_tests_passed == g_tests_run) ? 0 : 1;
}
