#ifndef MEMK_ARENA_H
#define MEMK_ARENA_H

#include "mab.h"
#include <stdbool.h>

typedef enum {
    POLICY_FIRST_FIT = 0,
    POLICY_NEXT_FIT  = 1,
    POLICY_BEST_FIT  = 2,
    POLICY_WORST_FIT = 3
} Policy;

typedef enum {
    TRACE_SKIP_ALLOCATED,
    TRACE_REJECT_TOO_SMALL,
    TRACE_ACCEPT_FIRST_FIT,
    TRACE_CANDIDATE_BEST,
    TRACE_REJECT_NOT_BEST,
    TRACE_CANDIDATE_WORST,
    TRACE_REJECT_NOT_LARGEST,
    TRACE_SELECTED,
    TRACE_UNVISITED
} TraceVerdict;

typedef struct {
    int blockOffset;
    int blockSize;
    int isAllocated;
    TraceVerdict verdict;
    char reason[64];
} TraceEntry;

#define MAX_TRACE_ENTRIES 256

typedef struct {
    int count;
    TraceEntry entries[MAX_TRACE_ENTRIES];
    int searchSteps;
    int freeBlocksExamined;
} Trace;

typedef enum {
    FAIL_NONE = 0,
    FAIL_INVALID_REQUEST,
    FAIL_INSUFFICIENT_TOTAL,
    FAIL_NO_CONTIGUOUS_BLOCK
} AllocFailureReason;

typedef struct {
    int freedOffset;
    int freedSize;
    int prevMerged;
    int prevOffset;
    int prevSize;
    int nextMerged;
    int nextOffset;
    int nextSize;
    int survivingOffset;
    int survivingSize;
} FreeInfo;

typedef struct {
    int total;
    int allocated;
    int free;
    int freeBlockCount;
    int largestFree;
    int smallestFree;
    double utilization;
    double externalFragmentation;
    bool isExternalFragUndefined;
    double largestFreePctOfTotal;
    int failedAttempts;
    int processesDelayed;
    int searchSteps;
    double dragonPower;
    int dragonTier;
    int cracks;
} ArenaStatistics;

typedef struct {
    MabPtr head;
    int total;
    MabPtr nextFit;
    int nextFitOffset;
    int successfulAttempts;
    int failedAttempts;
    int processesDelayed;
    int totalSearchSteps;
    AllocFailureReason lastFailureReason;
} Arena;

/* Lifecycle */
void arenaInit(Arena *a, int total);
void arenaDestroy(Arena *a);
void arenaReset(Arena *a);
int arenaLoadLayout(Arena *a, const int *sizes, const int *allocated, int count);

/* Validation and Invariants */
int arenaValidate(const Arena *a);

/* Operations */
int arenaAlloc(Arena *a, Policy p, int size, Trace *t, MabPtr *out);
int arenaFree(Arena *a, int offset, FreeInfo *info);
int arenaMerge(Arena *a, MabPtr free_block);

/* Statistics and Utilities */
void arenaGetStats(const Arena *a, ArenaStatistics *stats);
const char *policyToString(Policy p);
Policy stringToPolicy(const char *str);
const char *failureReasonToString(AllocFailureReason reason);
const char *verdictToString(TraceVerdict verdict);

#endif /* MEMK_ARENA_H */
