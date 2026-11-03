#include "posix-executor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include <sys/wait.h>
#include <sys/prctl.h>
#include <dirent.h>
#include <time.h>
#include <errno.h>

static char g_workerPath[512] = "./memk-worker";
static double g_speedMultiplier = 1.0;
static pid_t g_childPids[MAX_PROCESSES];
static Scheduler *g_scheduler = NULL;
static bool g_initialized = false;

static void sleepMicros(long us) {
    if (us <= 0) return;
    struct timespec req;
    req.tv_sec = us / 1000000;
    req.tv_nsec = (us % 1000000) * 1000;
    nanosleep(&req, NULL);
}

/* Signal handler for parent dispatcher cleanup */
static void parent_signal_handler(int sig) {
    (void)sig;
    posixExecutorCleanup();
    _exit(1);
}

int posixExecutorInit(const char *workerPath, double speedMultiplier) {
    if (workerPath != NULL) {
        /* Resolve absolute path */
        if (workerPath[0] == '/') {
            strncpy(g_workerPath, workerPath, sizeof(g_workerPath) - 1);
        } else {
            char cwd[400];
            if (getcwd(cwd, sizeof(cwd)) != NULL) {
                snprintf(g_workerPath, sizeof(g_workerPath), "%s/%s", cwd, workerPath);
            } else {
                strncpy(g_workerPath, workerPath, sizeof(g_workerPath) - 1);
            }
        }
        g_workerPath[sizeof(g_workerPath) - 1] = '\0';
    }

    g_speedMultiplier = (speedMultiplier > 0.0) ? speedMultiplier : 1.0;
    memset(g_childPids, 0, sizeof(g_childPids));

    /* Register cleanup on SIGINT and SIGTERM to avoid leaving children behind */
    struct sigaction sa;
    sa.sa_handler = parent_signal_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    g_initialized = true;
    return 0;
}

void posixSetScheduler(Scheduler *s) {
    g_scheduler = s;
}

bool posixIsOwnedChild(pid_t pid) {
    if (pid <= 1) return false;
    for (int i = 0; i < MAX_PROCESSES; i++) {
        if (g_childPids[i] == pid) return true;
    }
    return false;
}

pid_t posixGetOsPid(int simPid) {
    if (simPid < 0 || simPid >= MAX_PROCESSES) return -1;
    return g_childPids[simPid];
}

static void posixStart(int simPid) {
    if (simPid < 0 || simPid >= MAX_PROCESSES) return;

    pid_t pid = fork();
    if (pid < 0) {
        perror("fork failed in posixStart");
        return;
    }

    if (pid == 0) {
        /* Child process */
        prctl(PR_SET_PDEATHSIG, SIGKILL);
        char pidArg[16];
        snprintf(pidArg, sizeof(pidArg), "%d", simPid);
        char *argv[] = { g_workerPath, pidArg, NULL };
        execv(g_workerPath, argv);
        /* If execv fails */
        _exit(127);
    }

    /* Parent process */
    g_childPids[simPid] = pid;
    if (g_scheduler != NULL && simPid < g_scheduler->processCount) {
        g_scheduler->processes[simPid].osPid = pid;
    }
}

static void posixSuspend(int simPid) {
    if (simPid < 0 || simPid >= MAX_PROCESSES) return;
    pid_t pid = g_childPids[simPid];
    if (!posixIsOwnedChild(pid)) return;

    kill(pid, SIGTSTP);

    /* Wait for child to stop */
    int status = 0;
    for (int retry = 0; retry < 100; retry++) {
        pid_t r = waitpid(pid, &status, WUNTRACED | WNOHANG);
        if (r == pid && WIFSTOPPED(status)) {
            break;
        }
        sleepMicros(1000);
    }
}

static void posixResume(int simPid) {
    if (simPid < 0 || simPid >= MAX_PROCESSES) return;
    pid_t pid = g_childPids[simPid];
    if (!posixIsOwnedChild(pid)) return;

    kill(pid, SIGCONT);

    int status = 0;
    for (int retry = 0; retry < 50; retry++) {
        pid_t r = waitpid(pid, &status, WCONTINUED | WNOHANG);
        if (r == pid) {
            break;
        }
        sleepMicros(500);
    }
}

static void posixTerminate(int simPid) {
    if (simPid < 0 || simPid >= MAX_PROCESSES) return;
    pid_t pid = g_childPids[simPid];
    if (!posixIsOwnedChild(pid)) return;

    kill(pid, SIGINT);

    /* Wait with grace period to reap */
    int status = 0;
    bool reaped = false;
    for (int retry = 0; retry < 50; retry++) {
        pid_t r = waitpid(pid, &status, WNOHANG);
        if (r == pid && (WIFEXITED(status) || WIFSIGNALED(status))) {
            reaped = true;
            break;
        }
        sleepMicros(2000);
    }

    if (!reaped) {
        /* Force kill if child did not exit within grace period */
        kill(pid, SIGKILL);
        waitpid(pid, &status, 0);
    }

    g_childPids[simPid] = 0;
    if (g_scheduler != NULL && simPid < g_scheduler->processCount) {
        g_scheduler->processes[simPid].osPid = 0;
    }
}

static void posixWaitQuantum(int quantum) {
    if (quantum <= 0) quantum = 1;
    double durationSec = (double)quantum / g_speedMultiplier;
    long totalMicrosec = (long)(durationSec * 1000000.0);
    if (totalMicrosec > 0) {
        struct timespec req;
        req.tv_sec = totalMicrosec / 1000000;
        req.tv_nsec = (totalMicrosec % 1000000) * 1000;
        nanosleep(&req, NULL);
    }
}

SchedulerExecutor getPosixExecutor(void) {
    SchedulerExecutor exec = {
        .start = posixStart,
        .suspend = posixSuspend,
        .resume = posixResume,
        .terminate = posixTerminate,
        .waitQuantum = posixWaitQuantum
    };
    return exec;
}

void posixExecutorCleanup(void) {
    for (int i = 0; i < MAX_PROCESSES; i++) {
        pid_t pid = g_childPids[i];
        if (pid > 1) {
            kill(pid, SIGKILL);
            int status = 0;
            waitpid(pid, &status, 0);
            g_childPids[i] = 0;
        }
    }
}

int posixCountZombies(void) {
    pid_t myPid = getpid();
    DIR *dir = opendir("/proc");
    if (!dir) return 0;

    int zombieCount = 0;
    struct dirent *ent;

    while ((ent = readdir(dir)) != NULL) {
        if (ent->d_name[0] < '0' || ent->d_name[0] > '9') continue;

        char statPath[512];
        snprintf(statPath, sizeof(statPath), "/proc/%s/stat", ent->d_name);
        FILE *f = fopen(statPath, "r");
        if (!f) continue;

        int pid = 0, ppid = 0;
        char comm[64];
        char state = 0;
        if (fscanf(f, "%d %s %c %d", &pid, comm, &state, &ppid) == 4) {
            if (ppid == myPid && state == 'Z') {
                zombieCount++;
            }
        }
        fclose(f);
    }

    closedir(dir);
    return zombieCount;
}
