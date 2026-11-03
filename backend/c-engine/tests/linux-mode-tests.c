#define _DEFAULT_SOURCE 1
#define _POSIX_C_SOURCE 200809L
#include "scheduler.h"
#include "posix-executor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include <sys/wait.h>
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

static bool isProcessStopped(pid_t pid) {
    char statPath[512];
    snprintf(statPath, sizeof(statPath), "/proc/%d/stat", pid);
    FILE *f = fopen(statPath, "r");
    if (!f) return false;
    int p = 0;
    char comm[64];
    char state = 0;
    bool stopped = false;
    if (fscanf(f, "%d %s %c", &p, comm, &state) == 3) {
        stopped = (state == 'T');
    }
    fclose(f);
    return stopped;
}

/* ------------------------------------------------------------- */
/* 1. Real Signal Sequence Test                                  */
/* ------------------------------------------------------------- */
static int test_real_signal_sequence(void) {
    posixExecutorInit("./memk-worker", 100.0);
    SchedulerExecutor exec = getPosixExecutor();

    /* Start worker for simPid 0 */
    exec.start(0);
    pid_t pid = posixGetOsPid(0);
    TEST_ASSERT(pid > 1, "worker spawned with real osPid > 1");
    TEST_ASSERT(posixIsOwnedChild(pid), "worker is recognized as owned child");

    /* Confirm worker is running */
    usleep(10000); /* 10ms */
    int status = 0;
    pid_t r = waitpid(pid, &status, WNOHANG);
    TEST_ASSERT(r == 0, "worker is running, not terminated");
    TEST_ASSERT(!isProcessStopped(pid), "worker is not stopped");

    /* Suspend with SIGTSTP */
    exec.suspend(0);
    usleep(5000);
    TEST_ASSERT(isProcessStopped(pid), "worker stopped via SIGTSTP (state T in /proc)");

    /* Resume with SIGCONT */
    exec.resume(0);
    usleep(10000);
    TEST_ASSERT(!isProcessStopped(pid), "worker resumed (no longer state T)");

    /* Terminate with SIGINT */
    exec.terminate(0);
    r = waitpid(pid, &status, WNOHANG);
    TEST_ASSERT(r == -1, "worker reaped cleanly (waitpid returns -1)");
    TEST_ASSERT(posixGetOsPid(0) == 0, "osPid cleared in table");

    posixExecutorCleanup();
    return 1;
}

/* ------------------------------------------------------------- */
/* 2. Zombie Prevention Test                                     */
/* ------------------------------------------------------------- */
static int test_zombie_prevention(void) {
    posixExecutorInit("./memk-worker", 200.0);
    SchedulerExecutor exec = getPosixExecutor();

    /* Spawn, suspend, and terminate 5 workers */
    for (int i = 0; i < 5; i++) {
        exec.start(i);
        usleep(5000);
        exec.suspend(i);
        usleep(5000);
        exec.resume(i);
        usleep(5000);
        exec.terminate(i);
    }

    /* Verify no zombie processes exist in /proc */
    int zombies = posixCountZombies();
    TEST_ASSERT(zombies == 0, "Zero zombie processes remain in /proc");

    posixExecutorCleanup();
    return 1;
}

/* ------------------------------------------------------------- */
/* 3. Unrelated PID Protection Test                              */
/* ------------------------------------------------------------- */
static int test_unrelated_pid_protection(void) {
    posixExecutorInit("./memk-worker", 100.0);
    SchedulerExecutor exec = getPosixExecutor();

    /* Ensure attempts to signal PID 0, -1, or unowned PIDs are ignored */
    TEST_ASSERT(!posixIsOwnedChild(0), "PID 0 is not owned");
    TEST_ASSERT(!posixIsOwnedChild(1), "PID 1 is not owned");
    TEST_ASSERT(!posixIsOwnedChild(-1), "PID -1 is not owned");
    TEST_ASSERT(!posixIsOwnedChild(99999), "Arbitrary PID is not owned");

    /* Calling suspend/resume/terminate on unowned simPid must be safe no-op */
    exec.suspend(55);
    exec.resume(55);
    exec.terminate(55);

    posixExecutorCleanup();
    return 1;
}

/* ------------------------------------------------------------- */
/* 4. Orphan Prevention via PR_SET_PDEATHSIG                     */
/* ------------------------------------------------------------- */
static int test_orphan_prevention(void) {
    /* Fork a dummy dispatcher */
    pid_t dispatcherPid = fork();
    if (dispatcherPid == 0) {
        /* In child dispatcher: spawn a worker */
        posixExecutorInit("./memk-worker", 1.0);
        SchedulerExecutor exec = getPosixExecutor();
        exec.start(0);
        pid_t workerPid = posixGetOsPid(0);

        /* Write workerPid to pipe/stdout for parent */
        FILE *f = fopen("/tmp/memk_worker_test.pid", "w");
        if (f) {
            fprintf(f, "%d\n", workerPid);
            fclose(f);
        }

        /* Sleep forever until killed */
        while (1) pause();
        _exit(0);
    }

    /* Wait for child dispatcher to spawn worker */
    usleep(50000); /* 50ms */
    pid_t workerPid = 0;
    FILE *f = fopen("/tmp/memk_worker_test.pid", "r");
    if (f) {
        if (fscanf(f, "%d", &workerPid) == 1) {}
        fclose(f);
        unlink("/tmp/memk_worker_test.pid");
    }

    TEST_ASSERT(workerPid > 1, "workerPid retrieved");

    /* Kill the dispatcher with SIGKILL (simulating sudden crash) */
    kill(dispatcherPid, SIGKILL);
    int status;
    waitpid(dispatcherPid, &status, 0);

    /* Wait up to 200ms for kernel PR_SET_PDEATHSIG to deliver SIGKILL to worker */
    bool workerDied = false;
    for (int retry = 0; retry < 20; retry++) {
        usleep(10000);
        /* Check if worker still exists by sending signal 0 */
        if (kill(workerPid, 0) == -1) {
            workerDied = true;
            break;
        }
    }

    TEST_ASSERT(workerDied, "Worker terminated by kernel PR_SET_PDEATHSIG when parent died");
    return 1;
}

/* ------------------------------------------------------------- */
/* 5. Parity between PosixExecutor and VirtualExecutor           */
/* ------------------------------------------------------------- */
typedef struct {
    char events[256][64];
    int eventCount;
} EventLog;

static void parityEventCb(int seq, int t, const char *kind, const char *jsonData, void *userData) {
    (void)seq;
    (void)t;
    (void)jsonData;
    EventLog *log = (EventLog *)userData;
    if (log->eventCount < 256) {
        strncpy(log->events[log->eventCount++], kind, 63);
    }
}

static int test_posix_virtual_parity(void) {
    /* 1. Run assignment dataset with VirtualExecutor */
    Scheduler sVirt;
    SchedulerConfig cfg = {
        .policy = POLICY_FIRST_FIT,
        .quantum = 1,
        .totalMemory = 1024,
        .demotionTrigger = DEMOTE_ALWAYS,
        .admissionOrdering = ADMISSION_FIFO_BLOCK
    };
    schedulerInit(&sVirt, &cfg, NULL);
    EventLog virtLog = { .eventCount = 0 };
    schedulerSetEventCallback(&sVirt, parityEventCb, &virtLog);
    schedulerLoadAssignmentDataset(&sVirt);
    schedulerRun(&sVirt, 8); /* Run through P6, P7, P8 admission */

    /* 2. Run assignment dataset with PosixExecutor */
    posixExecutorInit("./memk-worker", 2000.0); /* Fast speed for testing */
    SchedulerExecutor posixExec = getPosixExecutor();

    Scheduler sPosix;
    schedulerInit(&sPosix, &cfg, &posixExec);
    posixSetScheduler(&sPosix);
    EventLog posixLog = { .eventCount = 0 };
    schedulerSetEventCallback(&sPosix, parityEventCb, &posixLog);
    schedulerLoadAssignmentDataset(&sPosix);
    schedulerRun(&sPosix, 8);

    /* Assert parity */
    TEST_ASSERT(sVirt.t == sPosix.t, "Same simulation tick");
    TEST_ASSERT(sVirt.arena.head->offset == sPosix.arena.head->offset, "Same head offset");
    TEST_ASSERT(sVirt.arena.nextFitOffset == sPosix.arena.nextFitOffset, "Same Next Fit pointer");

    for (int i = 0; i < 9; i++) {
        TEST_ASSERT(sVirt.processes[i].offset == sPosix.processes[i].offset, "Process offset match");
        TEST_ASSERT(sVirt.processes[i].state == sPosix.processes[i].state, "Process state match");
    }

    TEST_ASSERT(virtLog.eventCount == posixLog.eventCount, "Identical event count");
    for (int i = 0; i < virtLog.eventCount; i++) {
        TEST_ASSERT(strcmp(virtLog.events[i], posixLog.events[i]) == 0, "Identical event kind sequence");
    }

    posixExecutorCleanup();
    schedulerDestroy(&sPosix);
    schedulerDestroy(&sVirt);
    return 1;
}

int main(void) {
    printf("===========================================\n");
    printf(" MEMORY KINGDOM: Linux Mode Test Suite     \n");
    printf("===========================================\n");

    RUN_TEST(test_real_signal_sequence);
    RUN_TEST(test_zombie_prevention);
    RUN_TEST(test_unrelated_pid_protection);
    RUN_TEST(test_orphan_prevention);
    RUN_TEST(test_posix_virtual_parity);

    printf("===========================================\n");
    printf("Results: %d/%d tests passed.\n", g_tests_passed, g_tests_run);
    printf("===========================================\n");

    return (g_tests_passed == g_tests_run) ? 0 : 1;
}
