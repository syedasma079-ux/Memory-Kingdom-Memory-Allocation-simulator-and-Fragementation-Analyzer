#include "scheduler.h"
#include "protocol.h"
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
/* 1. Scheduler Tick Order & Queue Demotion                      */
/* ------------------------------------------------------------- */
static int test_scheduler_queue_demotion(void) {
    Scheduler s;
    SchedulerConfig cfg = {
        .policy = POLICY_FIRST_FIT,
        .quantum = 1,
        .totalMemory = 1024,
        .demotionTrigger = DEMOTE_ALWAYS,
        .admissionOrdering = ADMISSION_FIFO_BLOCK
    };
    schedulerInit(&s, &cfg, NULL);

    /* Single job requiring burst 4, arriving at t=0 */
    Process p = { .arrival = 0, .priority = 1, .cpuBurst = 4, .memMb = 100 };
    schedulerLoadWorkload(&s, &p, 1);

    /* t=0 boundary: arrivals -> admitted to Q1 -> dispatched to RUNNING */
    schedulerTick(&s);
    TEST_ASSERT(s.runningPid == 0, "P0 running at t=0");
    TEST_ASSERT(s.processes[0].state == STATE_RUNNING, "state is RUNNING");
    TEST_ASSERT(s.processes[0].queueLevel == 1, "in Q1 initially");

    /* t=1 boundary: ran 1 slice, remaining 3, demoted to Q2 -> dispatched from Q2 */
    schedulerTick(&s);
    TEST_ASSERT(s.runningPid == 0, "P0 running at t=1");
    TEST_ASSERT(s.processes[0].queueLevel == 2, "demoted to Q2");
    TEST_ASSERT(s.processes[0].remaining == 3, "remaining is 3");

    /* t=2 boundary: demoted to Q3 */
    schedulerTick(&s);
    TEST_ASSERT(s.runningPid == 0, "P0 running at t=2");
    TEST_ASSERT(s.processes[0].queueLevel == 3, "demoted to Q3");
    TEST_ASSERT(s.processes[0].remaining == 2, "remaining is 2");

    /* t=3 boundary: Q3 stays in Q3 */
    schedulerTick(&s);
    TEST_ASSERT(s.runningPid == 0, "P0 running at t=3");
    TEST_ASSERT(s.processes[0].queueLevel == 3, "Q3 stays in Q3");
    TEST_ASSERT(s.processes[0].remaining == 1, "remaining is 1");

    /* t=4 boundary: finished */
    schedulerTick(&s);
    TEST_ASSERT(s.processes[0].state == STATE_TERMINATED, "P0 terminated");
    TEST_ASSERT(s.processes[0].finishTime == 4, "finishTime is 4");
    TEST_ASSERT(s.arena.head->size == 1024 && !s.arena.head->allocated, "memory fully freed");
    TEST_ASSERT(s.isFinished, "simulation finished");

    schedulerDestroy(&s);
    return 1;
}

/* ------------------------------------------------------------- */
/* 2. Head-of-line blocking (ASM-2)                              */
/* ------------------------------------------------------------- */
static int test_head_of_line_blocking(void) {
    Scheduler s;
    SchedulerConfig cfg = {
        .policy = POLICY_FIRST_FIT,
        .quantum = 1,
        .totalMemory = 1024,
        .demotionTrigger = DEMOTE_ALWAYS,
        .admissionOrdering = ADMISSION_FIFO_BLOCK
    };
    schedulerInit(&s, &cfg, NULL);

    /* Allocate most memory first */
    MabPtr b;
    arenaAlloc(&s.arena, POLICY_FIRST_FIT, 900, NULL, &b);

    /* Two jobs arrive: P0 wants 200 MB (cannot fit), P1 wants 50 MB (can fit) */
    Process procs[2] = {
        { .arrival = 0, .priority = 1, .cpuBurst = 1, .memMb = 200 },
        { .arrival = 0, .priority = 1, .cpuBurst = 1, .memMb = 50 }
    };
    schedulerLoadWorkload(&s, procs, 2);

    /* Under fifo-block: P0 cannot fit -> admission stops! P1 is blocked behind P0 */
    schedulerTick(&s);
    TEST_ASSERT(s.processes[0].state == STATE_WAITING_FOR_MEMORY, "P0 waiting for memory");
    TEST_ASSERT(s.processes[1].state == STATE_WAITING_FOR_MEMORY, "P1 blocked behind P0");
    TEST_ASSERT(s.runningPid == -1, "No process dispatched");

    schedulerDestroy(&s);
    return 1;
}

/* ------------------------------------------------------------- */
/* 3. Golden verification across all ASM-1 & ASM-2 options       */
/* ------------------------------------------------------------- */
static int test_golden_under_asm_options(void) {
    DemotionTrigger demoteOpts[2] = { DEMOTE_ALWAYS, DEMOTE_ONLY_IF_CONTENDED };
    AdmissionOrdering admitOpts[2] = { ADMISSION_FIFO_BLOCK, ADMISSION_SKIP_AHEAD };
    Policy policies[4] = { POLICY_FIRST_FIT, POLICY_NEXT_FIT, POLICY_BEST_FIT, POLICY_WORST_FIT };

    for (int d = 0; d < 2; d++) {
        for (int a = 0; a < 2; a++) {
            for (int p = 0; p < 4; p++) {
                Scheduler s;
                SchedulerConfig cfg = {
                    .policy = policies[p],
                    .quantum = 1,
                    .totalMemory = 1024,
                    .demotionTrigger = demoteOpts[d],
                    .admissionOrdering = admitOpts[a]
                };
                schedulerInit(&s, &cfg, NULL);
                schedulerLoadAssignmentDataset(&s);

                /* Run to t=6 */
                schedulerRun(&s, 6);

                /* Verify G1 at t=6 */
                int expOffsets[] = { 0, 192, 224, 640, 672, 832, 960 };
                int expSizes[]   = { 192, 32, 416, 32, 160, 128, 64 };
                int expAlloc[]   = { 0, 1, 0, 1, 0, 1, 0 };

                MabPtr curr = s.arena.head;
                for (int k = 0; k < 7; k++) {
                    TEST_ASSERT(curr != NULL, "G1 block exists");
                    TEST_ASSERT(curr->offset == expOffsets[k], "G1 offset match");
                    TEST_ASSERT(curr->size == expSizes[k], "G1 size match");
                    TEST_ASSERT(curr->allocated == expAlloc[k], "G1 allocated match");
                    curr = curr->next;
                }
                TEST_ASSERT(curr == NULL, "G1 exactly 7 blocks");
                TEST_ASSERT(s.arena.nextFitOffset == 960, "G1 next fit pointer 960");

                /* Step t=6 (slice [6,7) runs P1) and then step t=7 (P6, P7, P8 arrive and are admitted) */
                schedulerTick(&s); /* boundary t=6: dispatches P1 for slice [6, 7) */
                schedulerTick(&s); /* boundary t=7: P6, P7, P8 arrive and are admitted */

                /* Verify G2 */
                int expP6[] = { 0, 0, 672, 224 };
                int expP7[] = { 224, 224, 224, 332 };
                int expP8[] = { 108, 480, 480, 0 };

                TEST_ASSERT(s.processes[6].offset == expP6[p], "G2 P6 offset match");
                TEST_ASSERT(s.processes[7].offset == expP7[p], "G2 P7 offset match");
                TEST_ASSERT(s.processes[8].offset == expP8[p], "G2 P8 offset match");

                /* Verify G3 statistics */
                ArenaStatistics st;
                arenaGetStats(&s.arena, &st);
                TEST_ASSERT(st.free == 388, "G3 total free 388");

                if (policies[p] == POLICY_FIRST_FIT) {
                    TEST_ASSERT(st.largestFree == 160, "G3 FF largest free 160");
                    TEST_ASSERT(fabs(st.externalFragmentation - 58.76) < 0.01, "G3 FF extFrag 58.76%");
                } else if (policies[p] == POLICY_NEXT_FIT) {
                    TEST_ASSERT(s.arena.nextFitOffset == 560, "G3 NF pointer 560");
                    TEST_ASSERT(st.largestFree == 160, "G3 NF largest free 160");
                    TEST_ASSERT(fabs(st.externalFragmentation - 58.76) < 0.01, "G3 NF extFrag 58.76%");
                } else if (policies[p] == POLICY_BEST_FIT) {
                    TEST_ASSERT(st.largestFree == 192, "G3 BF largest free 192");
                    TEST_ASSERT(fabs(st.externalFragmentation - 50.52) < 0.01, "G3 BF extFrag 50.52%");
                } else if (policies[p] == POLICY_WORST_FIT) {
                    TEST_ASSERT(st.largestFree == 160, "G3 WF largest free 160");
                    TEST_ASSERT(fabs(st.externalFragmentation - 58.76) < 0.01, "G3 WF extFrag 58.76%");
                }

                schedulerDestroy(&s);
            }
        }
    }
    return 1;
}

/* ------------------------------------------------------------- */
/* 4. JSON Protocol Line Execution Test                          */
/* ------------------------------------------------------------- */
static int test_protocol_line_execution(void) {
    ProtocolSession ps;
    protocolSessionInit(&ps);

    FILE *tmpOut = tmpfile();
    TEST_ASSERT(tmpOut != NULL, "tmpfile created");

    /* 1. session.configure */
    protocolProcessLine(&ps, "{\"id\":1,\"cmd\":\"session.configure\",\"policy\":\"best_fit\",\"quantum\":1}", tmpOut);
    TEST_ASSERT(ps.scheduler.config.policy == POLICY_BEST_FIT, "configured best_fit");

    /* 2. workload.assignment */
    protocolProcessLine(&ps, "{\"id\":2,\"cmd\":\"workload.assignment\"}", tmpOut);
    TEST_ASSERT(ps.scheduler.processCount == 9, "9 processes loaded");

    /* 3. sim.run until t=6 */
    protocolProcessLine(&ps, "{\"id\":3,\"cmd\":\"sim.run\",\"untilT\":6}", tmpOut);
    TEST_ASSERT(ps.scheduler.t == 6, "simulation at t=6");
    TEST_ASSERT(ps.scheduler.arena.nextFitOffset == 960, "next fit pointer at 960");

    /* 4. snapshot.get */
    protocolProcessLine(&ps, "{\"id\":4,\"cmd\":\"snapshot.get\"}", tmpOut);

    /* 5. compare.run */
    protocolProcessLine(&ps, "{\"id\":5,\"cmd\":\"compare.run\"}", tmpOut);

    /* 6. arena.alloc manual */
    protocolProcessLine(&ps, "{\"id\":6,\"cmd\":\"arena.alloc\",\"pid\":99,\"size\":50}", tmpOut);

    /* 7. arena.free manual */
    protocolProcessLine(&ps, "{\"id\":7,\"cmd\":\"arena.free\",\"pid\":99}", tmpOut);

    fclose(tmpOut);
    protocolSessionDestroy(&ps);
    return 1;
}

int main(void) {
    printf("===========================================\n");
    printf(" MEMORY KINGDOM: Scheduler Core Test Suite \n");
    printf("===========================================\n");

    RUN_TEST(test_scheduler_queue_demotion);
    RUN_TEST(test_head_of_line_blocking);
    RUN_TEST(test_golden_under_asm_options);
    RUN_TEST(test_protocol_line_execution);

    printf("===========================================\n");
    printf("Results: %d/%d tests passed.\n", g_tests_passed, g_tests_run);
    printf("===========================================\n");

    return (g_tests_passed == g_tests_run) ? 0 : 1;
}
