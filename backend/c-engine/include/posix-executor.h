#ifndef MEMK_POSIX_EXECUTOR_H
#define MEMK_POSIX_EXECUTOR_H

#include "scheduler.h"
#include <sys/types.h>

/* Initialize POSIX process executor with path to memk-worker binary and simulation speed */
int posixExecutorInit(const char *workerPath, double speedMultiplier);

/* Clean up, terminate, and reap any remaining child processes */
void posixExecutorCleanup(void);

/* Get SchedulerExecutor interface backed by real Linux processes */
SchedulerExecutor getPosixExecutor(void);

/* Bind scheduler instance so osPid can be updated in process records */
void posixSetScheduler(Scheduler *s);

/* Query real OS PID for simulated process ID (-1 if not started/dead) */
pid_t posixGetOsPid(int simPid);

/* Helper to count zombie processes of current process by inspecting /proc */
int posixCountZombies(void);

/* Verify that a PID belongs to an active worker spawned by this executor */
bool posixIsOwnedChild(pid_t pid);

#endif /* MEMK_POSIX_EXECUTOR_H */
