#ifndef MEMK_SCHEDULER_H
#define MEMK_SCHEDULER_H

#include "arena.h"
#include <stdbool.h>

#define MAX_PROCESSES 512
#define MAX_QUEUE_SIZE 512

typedef enum {
    STATE_NOT_ARRIVED = 0,
    STATE_WAITING_FOR_MEMORY,
    STATE_READY,
    STATE_RUNNING,
    STATE_SUSPENDED,
    STATE_TERMINATED
} ProcessState;

typedef enum {
    DEMOTE_ALWAYS = 0,
    DEMOTE_ONLY_IF_CONTENDED = 1
} DemotionTrigger;

typedef enum {
    ADMISSION_FIFO_BLOCK = 0,
    ADMISSION_SKIP_AHEAD = 1
} AdmissionOrdering;

typedef struct {
    Policy policy;
    int quantum;
    int totalMemory;
    DemotionTrigger demotionTrigger;      /* ASM-1 */
    AdmissionOrdering admissionOrdering;  /* ASM-2 */
} SchedulerConfig;

typedef struct {
    int pid;
    char name[16];
    int arrival;
    int priority;      /* 1 = highest, 2 = medium, 3 = lowest */
    int cpuBurst;
    int remaining;
    int memMb;
    int printers;
    int scanners;
    int modems;
    int cds;
    int offset;        /* -1 if not allocated */
    ProcessState state;
    int queueLevel;    /* 0 = none/user job, 1 = Q1, 2 = Q2, 3 = Q3 */
    int admittedTime;
    int firstRunTime;
    int finishTime;
    int waitedForMemoryTicks;
    int osPid;         /* Real OS PID in Linux mode, 0 in Virtual mode */
} Process;

/* Queue structure for process IDs */
typedef struct {
    int pids[MAX_QUEUE_SIZE];
    int head;
    int tail;
    int count;
} ProcessQueue;

void queueInit(ProcessQueue *q);
bool queuePush(ProcessQueue *q, int pid);
int queuePop(ProcessQueue *q);
int queuePeek(const ProcessQueue *q);
bool queueRemove(ProcessQueue *q, int pid);
bool queueContains(const ProcessQueue *q, int pid);

/* Side table for offset to PID mapping (D3) */
typedef struct {
    int offset;
    int pid;
} OffsetPidMapping;

#define MAX_OFFSET_MAPPINGS 1024

typedef struct {
    OffsetPidMapping mappings[MAX_OFFSET_MAPPINGS];
    int count;
} OffsetPidTable;

void offsetTableInit(OffsetPidTable *table);
void offsetTableSet(OffsetPidTable *table, int offset, int pid);
int offsetTableGet(const OffsetPidTable *table, int offset);
void offsetTableRemove(OffsetPidTable *table, int offset);

/* Executor interface */
typedef struct {
    void (*start)(int pid);
    void (*suspend)(int pid);
    void (*resume)(int pid);
    void (*terminate)(int pid);
    void (*waitQuantum)(int quantum);
} SchedulerExecutor;

/* Event Callback */
typedef void (*EventCallback)(int seq, int t, const char *kind, const char *jsonData, void *userData);

/* Scheduler context */
typedef struct {
    Arena arena;
    SchedulerConfig config;
    Process processes[MAX_PROCESSES];
    int processCount;
    OffsetPidTable pidTable;

    ProcessQueue inputQueue;       /* Arrived, pending admission */
    ProcessQueue userJobQueue;     /* Arrived, waiting for memory */
    ProcessQueue feedbackQ1;       /* Priority 1 */
    ProcessQueue feedbackQ2;       /* Priority 2 */
    ProcessQueue feedbackQ3;       /* Priority 3 */

    int runningPid;                /* -1 if idle */
    int currentSliceRan;           /* Ticks current process has run in current slice */

    int t;                         /* Current tick */
    int seq;                       /* Monotonic event counter */
    bool isFinished;

    SchedulerExecutor executor;
    EventCallback onEvent;
    void *eventUserData;
} Scheduler;

void schedulerInit(Scheduler *s, const SchedulerConfig *cfg, const SchedulerExecutor *exec);
void schedulerDestroy(Scheduler *s);
void schedulerReset(Scheduler *s);
void schedulerSetEventCallback(Scheduler *s, EventCallback cb, void *userData);

int schedulerLoadWorkload(Scheduler *s, const Process *procs, int count);
int schedulerLoadAssignmentDataset(Scheduler *s);

/* Execution steps */
bool schedulerTick(Scheduler *s);
void schedulerRun(Scheduler *s, int untilT);

/* Snapshots and Inspection */
const char *processStateToString(ProcessState state);
int schedulerGetProcessPidByOffset(const Scheduler *s, int offset);

/* Side-by-side 4-policy comparison */
typedef struct {
    Policy policy;
    int successfulAttempts;
    int failedAttempts;
    int processesDelayed;
    int totalFree;
    int largestFree;
    int freeBlockCount;
    double utilization;
    double externalFragmentation;
    int totalSearchSteps;
    double avgMemoryWait;
    double avgTurnaround;
    int makespan;
} PolicyCompareResult;

void schedulerCompareRun(const Process *workload, int count, const SchedulerConfig *baseCfg, PolicyCompareResult results[4]);

#endif /* MEMK_SCHEDULER_H */

