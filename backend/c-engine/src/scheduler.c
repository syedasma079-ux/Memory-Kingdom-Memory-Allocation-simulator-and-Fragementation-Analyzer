#include "scheduler.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

/* Queue implementation */
void queueInit(ProcessQueue *q) {
    if (q == NULL) return;
    q->head = 0;
    q->tail = 0;
    q->count = 0;
}

bool queuePush(ProcessQueue *q, int pid) {
    if (q == NULL || q->count >= MAX_QUEUE_SIZE) return false;
    q->pids[q->tail] = pid;
    q->tail = (q->tail + 1) % MAX_QUEUE_SIZE;
    q->count++;
    return true;
}

int queuePop(ProcessQueue *q) {
    if (q == NULL || q->count == 0) return -1;
    int pid = q->pids[q->head];
    q->head = (q->head + 1) % MAX_QUEUE_SIZE;
    q->count--;
    return pid;
}

int queuePeek(const ProcessQueue *q) {
    if (q == NULL || q->count == 0) return -1;
    return q->pids[q->head];
}

bool queueRemove(ProcessQueue *q, int pid) {
    if (q == NULL || q->count == 0) return false;
    int newPids[MAX_QUEUE_SIZE];
    int newCount = 0;
    bool found = false;

    int idx = q->head;
    for (int i = 0; i < q->count; i++) {
        if (!found && q->pids[idx] == pid) {
            found = true;
        } else {
            newPids[newCount++] = q->pids[idx];
        }
        idx = (idx + 1) % MAX_QUEUE_SIZE;
    }

    if (found) {
        for (int i = 0; i < newCount; i++) {
            q->pids[i] = newPids[i];
        }
        q->head = 0;
        q->tail = newCount;
        q->count = newCount;
    }
    return found;
}

bool queueContains(const ProcessQueue *q, int pid) {
    if (q == NULL || q->count == 0) return false;
    int idx = q->head;
    for (int i = 0; i < q->count; i++) {
        if (q->pids[idx] == pid) return true;
        idx = (idx + 1) % MAX_QUEUE_SIZE;
    }
    return false;
}

/* Offset-to-PID Table (D3) */
void offsetTableInit(OffsetPidTable *table) {
    if (table == NULL) return;
    table->count = 0;
}

void offsetTableSet(OffsetPidTable *table, int offset, int pid) {
    if (table == NULL) return;
    for (int i = 0; i < table->count; i++) {
        if (table->mappings[i].offset == offset) {
            table->mappings[i].pid = pid;
            return;
        }
    }
    if (table->count < MAX_OFFSET_MAPPINGS) {
        table->mappings[table->count].offset = offset;
        table->mappings[table->count].pid = pid;
        table->count++;
    }
}

int offsetTableGet(const OffsetPidTable *table, int offset) {
    if (table == NULL) return -1;
    for (int i = 0; i < table->count; i++) {
        if (table->mappings[i].offset == offset) {
            return table->mappings[i].pid;
        }
    }
    return -1;
}

void offsetTableRemove(OffsetPidTable *table, int offset) {
    if (table == NULL) return;
    for (int i = 0; i < table->count; i++) {
        if (table->mappings[i].offset == offset) {
            table->mappings[i] = table->mappings[table->count - 1];
            table->count--;
            return;
        }
    }
}

/* Default Virtual Executor (deterministic) */
static void virtStart(int pid) { (void)pid; }
static void virtSuspend(int pid) { (void)pid; }
static void virtResume(int pid) { (void)pid; }
static void virtTerminate(int pid) { (void)pid; }
static void virtWaitQuantum(int q) { (void)q; }

static const SchedulerExecutor defaultVirtualExecutor = {
    .start = virtStart,
    .suspend = virtSuspend,
    .resume = virtResume,
    .terminate = virtTerminate,
    .waitQuantum = virtWaitQuantum
};

/* Scheduler Implementation */
void schedulerInit(Scheduler *s, const SchedulerConfig *cfg, const SchedulerExecutor *exec) {
    if (s == NULL) return;
    memset(s, 0, sizeof(Scheduler));

    if (cfg != NULL) {
        s->config = *cfg;
    } else {
        s->config.policy = POLICY_FIRST_FIT;
        s->config.quantum = 1;
        s->config.totalMemory = 1024;
        s->config.demotionTrigger = DEMOTE_ALWAYS;
        s->config.admissionOrdering = ADMISSION_FIFO_BLOCK;
    }

    if (exec != NULL) {
        s->executor = *exec;
    } else {
        s->executor = defaultVirtualExecutor;
    }

    arenaInit(&s->arena, s->config.totalMemory);
    offsetTableInit(&s->pidTable);

    queueInit(&s->inputQueue);
    queueInit(&s->userJobQueue);
    queueInit(&s->feedbackQ1);
    queueInit(&s->feedbackQ2);
    queueInit(&s->feedbackQ3);

    s->runningPid = -1;
    s->currentSliceRan = 0;
    s->t = 0;
    s->seq = 0;
    s->isFinished = false;
}

void schedulerDestroy(Scheduler *s) {
    if (s == NULL) return;
    arenaDestroy(&s->arena);
}

void schedulerReset(Scheduler *s) {
    if (s == NULL) return;
    SchedulerConfig cfg = s->config;
    SchedulerExecutor exec = s->executor;
    EventCallback cb = s->onEvent;
    void *ud = s->eventUserData;

    schedulerDestroy(s);
    schedulerInit(s, &cfg, &exec);
    schedulerSetEventCallback(s, cb, ud);
}

void schedulerSetEventCallback(Scheduler *s, EventCallback cb, void *userData) {
    if (s == NULL) return;
    s->onEvent = cb;
    s->eventUserData = userData;
}

static void emitEvent(Scheduler *s, const char *kind, const char *jsonData) {
    if (s->onEvent != NULL) {
        s->onEvent(s->seq++, s->t, kind, jsonData, s->eventUserData);
    }
}

int schedulerLoadWorkload(Scheduler *s, const Process *procs, int count) {
    if (s == NULL || procs == NULL || count <= 0) return -1;
    s->processCount = 0;
    queueInit(&s->inputQueue);

    for (int i = 0; i < count && i < MAX_PROCESSES; i++) {
        if (procs[i].memMb > s->config.totalMemory) {
            /* Process exceeds arena size: reject with error */
            return -2;
        }
        s->processes[i] = procs[i];
        s->processes[i].pid = i;
        if (procs[i].name[0] != '\0') {
            snprintf(s->processes[i].name, sizeof(s->processes[i].name), "%s", procs[i].name);
        } else {
            snprintf(s->processes[i].name, sizeof(s->processes[i].name), "P%d", i);
        }
        s->processes[i].remaining = procs[i].cpuBurst;
        s->processes[i].offset = -1;
        s->processes[i].state = STATE_NOT_ARRIVED;
        s->processes[i].queueLevel = 0;
        s->processes[i].admittedTime = -1;
        s->processes[i].firstRunTime = -1;
        s->processes[i].finishTime = -1;
        s->processes[i].waitedForMemoryTicks = 0;

        queuePush(&s->inputQueue, i);
        s->processCount++;
    }

    return 0;
}

int schedulerLoadAssignmentDataset(Scheduler *s) {
    /* 
       0, 1, 1, 192, 0, 0, 0, 0 (P0)
       0, 1, 3, 32, 0, 0, 0, 0  (P1)
       0, 1, 1, 416, 0, 0, 0, 0 (P2)
       0, 1, 3, 32, 0, 0, 0, 0  (P3)
       0, 1, 1, 160, 0, 0, 0, 0 (P4)
       0, 1, 3, 128, 0, 0, 0, 0 (P5)
       7, 1, 2, 108, 0, 0, 0, 0 (P6)
       7, 1, 2, 256, 0, 0, 0, 0 (P7)
       7, 1, 2, 80, 0, 0, 0, 0  (P8)
    */
    Process procs[9] = {
        { .arrival = 0, .priority = 1, .cpuBurst = 1, .memMb = 192 },
        { .arrival = 0, .priority = 1, .cpuBurst = 3, .memMb = 32 },
        { .arrival = 0, .priority = 1, .cpuBurst = 1, .memMb = 416 },
        { .arrival = 0, .priority = 1, .cpuBurst = 3, .memMb = 32 },
        { .arrival = 0, .priority = 1, .cpuBurst = 1, .memMb = 160 },
        { .arrival = 0, .priority = 1, .cpuBurst = 3, .memMb = 128 },
        { .arrival = 7, .priority = 1, .cpuBurst = 2, .memMb = 108 },
        { .arrival = 7, .priority = 1, .cpuBurst = 2, .memMb = 256 },
        { .arrival = 7, .priority = 1, .cpuBurst = 2, .memMb = 80 }
    };
    return schedulerLoadWorkload(s, procs, 9);
}

const char *processStateToString(ProcessState state) {
    switch (state) {
        case STATE_NOT_ARRIVED: return "NOT_ARRIVED";
        case STATE_WAITING_FOR_MEMORY: return "WAITING_FOR_MEMORY";
        case STATE_READY: return "READY";
        case STATE_RUNNING: return "RUNNING";
        case STATE_SUSPENDED: return "SUSPENDED";
        case STATE_TERMINATED: return "TERMINATED";
        default: return "UNKNOWN";
    }
}

int schedulerGetProcessPidByOffset(const Scheduler *s, int offset) {
    if (s == NULL) return -1;
    return offsetTableGet(&s->pidTable, offset);
}

bool schedulerTick(Scheduler *s) {
    if (s == NULL || s->isFinished) return false;
    if (s->processCount == 0) {
        s->isFinished = true;
        return false;
    }

    char buf[256];

    /* Step 1: Check running process from previous slice [t-quantum, t) */
    if (s->runningPid != -1) {
        Process *rp = &s->processes[s->runningPid];
        rp->remaining -= s->config.quantum;

        if (rp->remaining <= 0) {
            /* Process Finished */
            rp->state = STATE_TERMINATED;
            rp->finishTime = s->t;
            rp->queueLevel = 0;
            s->executor.terminate(rp->pid);

            snprintf(buf, sizeof(buf), "{\"pid\":%d,\"name\":\"%s\",\"finishTime\":%d}",
                     rp->pid, rp->name, rp->finishTime);
            emitEvent(s, "process_terminated", buf);

            /* Free memory through arenaFree */
            FreeInfo info;
            int offsetToFree = rp->offset;
            offsetTableRemove(&s->pidTable, offsetToFree);
            rp->offset = -1;

            arenaFree(&s->arena, offsetToFree, &info);

            snprintf(buf, sizeof(buf), "{\"pid\":%d,\"offset\":%d,\"size\":%d,\"prevMerged\":%d,\"nextMerged\":%d,\"survivingOffset\":%d,\"survivingSize\":%d}",
                     rp->pid, info.freedOffset, info.freedSize, info.prevMerged, info.nextMerged,
                     info.survivingOffset, info.survivingSize);
            emitEvent(s, "memory_released", buf);

            s->runningPid = -1;
        } else {
            /* Process not finished: check suspension and demotion */
            bool shouldDemote = true;
            if (s->config.demotionTrigger == DEMOTE_ONLY_IF_CONTENDED) {
                bool hasContention = (s->feedbackQ1.count > 0 || s->feedbackQ2.count > 0 ||
                                      s->feedbackQ3.count > 0 || s->userJobQueue.count > 0);
                if (!hasContention) {
                    shouldDemote = false;
                }
            }

            if (shouldDemote) {
                rp->state = STATE_SUSPENDED;
                s->executor.suspend(rp->pid);

                int oldLevel = rp->queueLevel;
                if (rp->queueLevel == 1) rp->queueLevel = 2;
                else if (rp->queueLevel == 2) rp->queueLevel = 3;
                else rp->queueLevel = 3; /* Q3 stays Q3 */

                if (rp->queueLevel == 2) queuePush(&s->feedbackQ2, rp->pid);
                else queuePush(&s->feedbackQ3, rp->pid);

                snprintf(buf, sizeof(buf), "{\"pid\":%d,\"fromQueue\":%d,\"toQueue\":%d,\"remaining\":%d}",
                         rp->pid, oldLevel, rp->queueLevel, rp->remaining);
                emitEvent(s, "process_demoted", buf);

                s->runningPid = -1;
            }
        }
    }

    /* Step 2: Unload pending processes with arrival <= t into User Job Queue (PID order) */
    int inputCount = s->inputQueue.count;
    for (int i = 0; i < inputCount; i++) {
        int pid = queuePop(&s->inputQueue);
        if (s->processes[pid].arrival <= s->t) {
            s->processes[pid].state = STATE_WAITING_FOR_MEMORY;
            queuePush(&s->userJobQueue, pid);

            snprintf(buf, sizeof(buf), "{\"pid\":%d,\"arrival\":%d,\"memMb\":%d,\"cpuBurst\":%d}",
                     pid, s->processes[pid].arrival, s->processes[pid].memMb, s->processes[pid].cpuBurst);
            emitEvent(s, "process_arrived", buf);
        } else {
            /* Re-enqueue if not yet arrived */
            queuePush(&s->inputQueue, pid);
        }
    }

    /* Step 3: Admission from User Job Queue */
    while (s->userJobQueue.count > 0) {
        int pid = queuePeek(&s->userJobQueue);
        Process *p = &s->processes[pid];

        Trace tr;
        MabPtr allocatedBlock = NULL;
        int rc = arenaAlloc(&s->arena, s->config.policy, p->memMb, &tr, &allocatedBlock);

        if (rc == 0 && allocatedBlock != NULL) {
            queuePop(&s->userJobQueue);
            p->offset = allocatedBlock->offset;
            offsetTableSet(&s->pidTable, p->offset, p->pid);
            p->admittedTime = s->t;
            p->state = STATE_READY; /* READY = admitted and never run (ASM-7) */
            p->queueLevel = p->priority;

            if (p->queueLevel == 1) queuePush(&s->feedbackQ1, pid);
            else if (p->queueLevel == 2) queuePush(&s->feedbackQ2, pid);
            else queuePush(&s->feedbackQ3, pid);

            snprintf(buf, sizeof(buf), "{\"pid\":%d,\"offset\":%d,\"size\":%d,\"policy\":\"%s\"}",
                     pid, p->offset, p->memMb, policyToString(s->config.policy));
            emitEvent(s, "process_admitted", buf);
        } else {
            /* Allocation failed */
            p->waitedForMemoryTicks++;
            s->arena.processesDelayed++;

            snprintf(buf, sizeof(buf), "{\"pid\":%d,\"size\":%d,\"reason\":\"%s\"}",
                     pid, p->memMb, failureReasonToString(s->arena.lastFailureReason));
            emitEvent(s, "alloc_failed", buf);

            if (s->config.admissionOrdering == ADMISSION_FIFO_BLOCK) {
                /* Head-of-line blocking (ASM-2): stop trying later jobs */
                break;
            } else {
                /* Skip-ahead: not supported in assignment mode, break anyway */
                break;
            }
        }
    }

    /* Step 4: Dispatch: pick head of highest non-empty feedback queue */
    if (s->runningPid == -1) {
        int nextPid = -1;
        if (s->feedbackQ1.count > 0) {
            nextPid = queuePop(&s->feedbackQ1);
        } else if (s->feedbackQ2.count > 0) {
            nextPid = queuePop(&s->feedbackQ2);
        } else if (s->feedbackQ3.count > 0) {
            nextPid = queuePop(&s->feedbackQ3);
        }

        if (nextPid != -1) {
            Process *np = &s->processes[nextPid];
            if (np->state == STATE_READY) {
                np->firstRunTime = s->t;
                s->executor.start(np->pid);
            } else {
                s->executor.resume(np->pid);
            }
            np->state = STATE_RUNNING;
            s->runningPid = nextPid;

            snprintf(buf, sizeof(buf), "{\"pid\":%d,\"name\":\"%s\",\"remaining\":%d,\"queueLevel\":%d}",
                     np->pid, np->name, np->remaining, np->queueLevel);
            emitEvent(s, "process_dispatched", buf);
        } else {
            /* No process runnable: emit idle (ASM-6) */
            emitEvent(s, "idle", "{}");
        }
    }

    /* Advance simulation clock */
    s->t++;

    /* Check completion: all processes in TERMINATED state */
    bool allTerminated = true;
    for (int i = 0; i < s->processCount; i++) {
        if (s->processes[i].state != STATE_TERMINATED) {
            allTerminated = false;
            break;
        }
    }

    if (allTerminated && s->processCount > 0) {
        s->isFinished = true;
        emitEvent(s, "sim_finished", "{}");
    }

    return true;
}

void schedulerRun(Scheduler *s, int untilT) {
    if (s == NULL || s->processCount == 0) return;
    int maxSafetyTicks = 20000;
    int executed = 0;
    while (!s->isFinished && executed < maxSafetyTicks) {
        if (untilT >= 0 && s->t >= untilT) {
            break;
        }
        schedulerTick(s);
        executed++;
    }
}

void schedulerCompareRun(const Process *workload, int count, const SchedulerConfig *baseCfg, PolicyCompareResult results[4]) {
    Policy policies[4] = { POLICY_FIRST_FIT, POLICY_NEXT_FIT, POLICY_BEST_FIT, POLICY_WORST_FIT };

    for (int p = 0; p < 4; p++) {
        Scheduler s;
        SchedulerConfig cfg = (baseCfg != NULL) ? *baseCfg : (SchedulerConfig){
            .policy = policies[p],
            .quantum = 1,
            .totalMemory = 1024,
            .demotionTrigger = DEMOTE_ALWAYS,
            .admissionOrdering = ADMISSION_FIFO_BLOCK
        };
        cfg.policy = policies[p];

        schedulerInit(&s, &cfg, NULL);
        schedulerLoadWorkload(&s, workload, count);
        schedulerRun(&s, -1); /* Run until end */

        ArenaStatistics st;
        arenaGetStats(&s.arena, &st);

        results[p].policy = policies[p];
        results[p].successfulAttempts = st.failedAttempts == 0 ? count : s.arena.successfulAttempts;
        results[p].failedAttempts = st.failedAttempts;
        results[p].processesDelayed = s.arena.processesDelayed;
        results[p].totalFree = st.free;
        results[p].largestFree = st.largestFree;
        results[p].freeBlockCount = st.freeBlockCount;
        results[p].utilization = st.utilization;
        results[p].externalFragmentation = st.externalFragmentation;
        results[p].totalSearchSteps = st.searchSteps;
        results[p].makespan = s.t;

        double totalWait = 0.0;
        double totalTurnaround = 0.0;
        for (int i = 0; i < s.processCount; i++) {
            totalWait += s.processes[i].waitedForMemoryTicks;
            totalTurnaround += (s.processes[i].finishTime - s.processes[i].arrival);
        }
        results[p].avgMemoryWait = (s.processCount > 0) ? (totalWait / s.processCount) : 0.0;
        results[p].avgTurnaround = (s.processCount > 0) ? (totalTurnaround / s.processCount) : 0.0;

        schedulerDestroy(&s);
    }
}
