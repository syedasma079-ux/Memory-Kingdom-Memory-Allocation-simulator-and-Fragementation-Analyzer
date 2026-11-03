#include "arena.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

void arenaInit(Arena *a, int total) {
    if (a == NULL) return;
    a->total = total;
    a->successfulAttempts = 0;
    a->failedAttempts = 0;
    a->processesDelayed = 0;
    a->totalSearchSteps = 0;
    a->lastFailureReason = FAIL_NONE;

    MabPtr initial = (MabPtr)malloc(sizeof(Mab));
    assert(initial != NULL);
    initial->offset = 0;
    initial->size = total;
    initial->allocated = 0;
    initial->prev = NULL;
    initial->next = NULL;

    a->head = initial;
    a->nextFit = initial;
    a->nextFitOffset = 0;

    arenaValidate(a);
}

void arenaDestroy(Arena *a) {
    if (a == NULL) return;
    MabPtr curr = a->head;
    while (curr != NULL) {
        MabPtr next = curr->next;
        free(curr);
        curr = next;
    }
    a->head = NULL;
    a->nextFit = NULL;
    a->nextFitOffset = 0;
    a->total = 0;
}

void arenaReset(Arena *a) {
    if (a == NULL) return;
    int total = a->total;
    arenaDestroy(a);
    arenaInit(a, total);
}

int arenaLoadLayout(Arena *a, const int *sizes, const int *allocated, int count) {
    if (a == NULL || sizes == NULL || allocated == NULL || count <= 0) {
        return -1;
    }

    /* Verify sum equals total and sizes > 0 */
    int sum = 0;
    for (int i = 0; i < count; i++) {
        if (sizes[i] <= 0) return -1;
        if (allocated[i] != 0 && allocated[i] != 1) return -1;
        if (i > 0 && allocated[i] == 0 && allocated[i - 1] == 0) {
            /* Adjacent free blocks violate invariants */
            return -1;
        }
        sum += sizes[i];
    }
    if (sum != a->total) {
        return -1;
    }

    /* Free existing list */
    MabPtr curr = a->head;
    while (curr != NULL) {
        MabPtr next = curr->next;
        free(curr);
        curr = next;
    }

    /* Build new list */
    MabPtr prev = NULL;
    MabPtr head = NULL;
    int currOffset = 0;

    for (int i = 0; i < count; i++) {
        MabPtr node = (MabPtr)malloc(sizeof(Mab));
        assert(node != NULL);
        node->offset = currOffset;
        node->size = sizes[i];
        node->allocated = allocated[i];
        node->prev = prev;
        node->next = NULL;

        if (prev != NULL) {
            prev->next = node;
        } else {
            head = node;
        }
        prev = node;
        currOffset += sizes[i];
    }

    a->head = head;
    a->nextFit = head;
    a->nextFitOffset = head->offset;

    return arenaValidate(a) ? 0 : -1;
}

int arenaValidate(const Arena *a) {
    if (a == NULL) return 0;
    if (a->head == NULL) return 0;
    if (a->head->offset != 0) return 0;
    if (a->head->prev != NULL) return 0;

    const Mab *curr = a->head;
    const Mab *foundNextFit = NULL;
    int expectedOffset = 0;

    while (curr != NULL) {
        if (curr->offset != expectedOffset) return 0;
        if (curr->size <= 0) return 0;
        if (curr->allocated != 0 && curr->allocated != 1) return 0;

        if (curr == a->nextFit) {
            foundNextFit = curr;
        }

        if (curr->next != NULL) {
            if (curr->next->prev != curr) return 0;
            /* Invariant: No two adjacent free blocks */
            if (!curr->allocated && !curr->next->allocated) return 0;
        } else {
            /* Last block: must reach total */
            if (curr->offset + curr->size != a->total) return 0;
        }

        expectedOffset += curr->size;
        curr = curr->next;
    }

    /* Next Fit pointer invariants */
    if (a->nextFit == NULL) return 0;
    if (foundNextFit == NULL) return 0; /* nextFit must be reachable from head */
    if (a->nextFit->offset != a->nextFitOffset) return 0;

    return 1;
}

int arenaFree(Arena *a, int offset, FreeInfo *info) {
    if (a == NULL || a->head == NULL) return -1;

    /* 1. Locate the block b with b->offset == offset */
    MabPtr b = a->head;
    while (b != NULL && b->offset != offset) {
        b = b->next;
    }

    /* No such block, or b not allocated (double free) */
    if (b == NULL || !b->allocated) {
        return -1;
    }

    /* 2. Predict the merge without mutating */
    bool prevFree = (b->prev != NULL && !b->prev->allocated);
    bool nextFree = (b->next != NULL && !b->next->allocated);
    MabPtr survivor = prevFree ? b->prev : b;
    MabPtr nextNode = b->next;

    if (info != NULL) {
        info->freedOffset = b->offset;
        info->freedSize = b->size;
        info->prevMerged = prevFree ? 1 : 0;
        info->prevOffset = prevFree ? b->prev->offset : -1;
        info->prevSize = prevFree ? b->prev->size : 0;
        info->nextMerged = nextFree ? 1 : 0;
        info->nextOffset = nextFree ? nextNode->offset : -1;
        info->nextSize = nextFree ? nextNode->size : 0;
    }

    /* 3. Repair first: if a->nextFit is in absorbed, set a->nextFit = survivor */
    bool nextFitAbsorbed = (prevFree && a->nextFit == b) || (nextFree && a->nextFit == nextNode);
    if (nextFitAbsorbed) {
        a->nextFit = survivor;
        a->nextFitOffset = survivor->offset;
    }

    /* 4. Call memFree(b); assert returned block equals survivor */
    MabPtr res = memFree(b);
    assert(res == survivor);

    /* 5. Lowest address block is head; if survivor offset == 0 it is the new head */
    if (survivor->offset == 0) {
        a->head = survivor;
    }

    if (info != NULL) {
        info->survivingOffset = survivor->offset;
        info->survivingSize = survivor->size;
    }

    /* Invariant check */
    assert(arenaValidate(a));
    return 0;
}

int arenaMerge(Arena *a, MabPtr free_block) {
    if (a == NULL || free_block == NULL || free_block->allocated) {
        return -1;
    }

    bool prevFree = (free_block->prev != NULL && !free_block->prev->allocated);
    bool nextFree = (free_block->next != NULL && !free_block->next->allocated);
    MabPtr survivor = prevFree ? free_block->prev : free_block;
    MabPtr nextNode = free_block->next;

    bool nextFitAbsorbed = (prevFree && a->nextFit == free_block) || (nextFree && a->nextFit == nextNode);
    if (nextFitAbsorbed) {
        a->nextFit = survivor;
        a->nextFitOffset = survivor->offset;
    }

    MabPtr res = memMerge(free_block);
    assert(res == survivor);

    if (survivor->offset == 0) {
        a->head = survivor;
    }

    assert(arenaValidate(a));
    return 0;
}

static void addTraceEntry(Trace *t, const Mab *b, TraceVerdict v, const char *reason) {
    if (t == NULL || t->count >= MAX_TRACE_ENTRIES) return;
    TraceEntry *e = &t->entries[t->count++];
    e->blockOffset = b->offset;
    e->blockSize = b->size;
    e->isAllocated = b->allocated;
    e->verdict = v;
    strncpy(e->reason, reason, sizeof(e->reason) - 1);
    e->reason[sizeof(e->reason) - 1] = '\0';
}

int arenaAlloc(Arena *a, Policy p, int size, Trace *t, MabPtr *out) {
    if (out != NULL) *out = NULL;
    if (t != NULL) {
        t->count = 0;
        t->searchSteps = 0;
        t->freeBlocksExamined = 0;
    }

    if (a == NULL) return -1;

    /* Invalid size request */
    if (size < 1 || size > a->total) {
        a->lastFailureReason = FAIL_INVALID_REQUEST;
        a->failedAttempts++;
        return -1;
    }

    /* Compute total free and largest free */
    int totalFree = 0;
    int largestFree = 0;
    MabPtr curr = a->head;
    while (curr != NULL) {
        if (!curr->allocated) {
            totalFree += curr->size;
            if (curr->size > largestFree) {
                largestFree = curr->size;
            }
        }
        curr = curr->next;
    }

    if (totalFree < size) {
        a->lastFailureReason = FAIL_INSUFFICIENT_TOTAL;
        a->failedAttempts++;
        return -2;
    }

    if (largestFree < size) {
        a->lastFailureReason = FAIL_NO_CONTIGUOUS_BLOCK;
        a->failedAttempts++;
        return -3;
    }

    MabPtr chosen = NULL;

    if (p == POLICY_FIRST_FIT) {
        curr = a->head;
        while (curr != NULL) {
            if (t != NULL) t->searchSteps++;
            if (curr->allocated) {
                addTraceEntry(t, curr, TRACE_SKIP_ALLOCATED, "Block is allocated");
            } else {
                if (t != NULL) t->freeBlocksExamined++;
                if (curr->size < size) {
                    addTraceEntry(t, curr, TRACE_REJECT_TOO_SMALL, "Block is smaller than requested size");
                } else {
                    addTraceEntry(t, curr, TRACE_ACCEPT_FIRST_FIT, "First fit found");
                    chosen = curr;
                    break;
                }
            }
            curr = curr->next;
        }
    } else if (p == POLICY_BEST_FIT) {
        int bestSize = a->total + 1;
        curr = a->head;
        while (curr != NULL) {
            if (t != NULL) t->searchSteps++;
            if (curr->allocated) {
                addTraceEntry(t, curr, TRACE_SKIP_ALLOCATED, "Block is allocated");
            } else {
                if (t != NULL) t->freeBlocksExamined++;
                if (curr->size < size) {
                    addTraceEntry(t, curr, TRACE_REJECT_TOO_SMALL, "Block is smaller than requested size");
                } else if (chosen == NULL || curr->size < bestSize) {
                    chosen = curr;
                    bestSize = curr->size;
                    addTraceEntry(t, curr, TRACE_CANDIDATE_BEST, "New best fit candidate");
                } else {
                    addTraceEntry(t, curr, TRACE_REJECT_NOT_BEST, "Not smaller than current best fit");
                }
            }
            curr = curr->next;
        }
    } else if (p == POLICY_WORST_FIT) {
        int worstSize = -1;
        curr = a->head;
        while (curr != NULL) {
            if (t != NULL) t->searchSteps++;
            if (curr->allocated) {
                addTraceEntry(t, curr, TRACE_SKIP_ALLOCATED, "Block is allocated");
            } else {
                if (t != NULL) t->freeBlocksExamined++;
                if (curr->size < size) {
                    addTraceEntry(t, curr, TRACE_REJECT_TOO_SMALL, "Block is smaller than requested size");
                } else if (chosen == NULL || curr->size > worstSize) {
                    chosen = curr;
                    worstSize = curr->size;
                    addTraceEntry(t, curr, TRACE_CANDIDATE_WORST, "New worst fit candidate");
                } else {
                    addTraceEntry(t, curr, TRACE_REJECT_NOT_LARGEST, "Not larger than current worst fit");
                }
            }
            curr = curr->next;
        }
    } else if (p == POLICY_NEXT_FIT) {
        MabPtr start = a->nextFit ? a->nextFit : a->head;
        curr = start;
        do {
            if (t != NULL) t->searchSteps++;
            if (curr->allocated) {
                addTraceEntry(t, curr, TRACE_SKIP_ALLOCATED, "Block is allocated");
            } else {
                if (t != NULL) t->freeBlocksExamined++;
                if (curr->size < size) {
                    addTraceEntry(t, curr, TRACE_REJECT_TOO_SMALL, "Block is smaller than requested size");
                } else {
                    addTraceEntry(t, curr, TRACE_ACCEPT_FIRST_FIT, "Next fit found");
                    chosen = curr;
                    break;
                }
            }
            curr = (curr->next != NULL) ? curr->next : a->head;
        } while (curr != start);
    }

    if (chosen == NULL) {
        a->failedAttempts++;
        a->lastFailureReason = FAIL_NO_CONTIGUOUS_BLOCK;
        return -3;
    }

    /* Mark chosen in trace if applicable */
    if (t != NULL && (p == POLICY_BEST_FIT || p == POLICY_WORST_FIT)) {
        for (int i = 0; i < t->count; i++) {
            if (t->entries[i].blockOffset == chosen->offset &&
                (t->entries[i].verdict == TRACE_CANDIDATE_BEST || t->entries[i].verdict == TRACE_CANDIDATE_WORST)) {
                t->entries[i].verdict = TRACE_SELECTED;
                strncpy(t->entries[i].reason, "Selected block", sizeof(t->entries[i].reason) - 1);
            }
        }
    }

    bool didSplit = (chosen->size > size);
    if (didSplit) {
        memSplit(chosen, size);
    }
    chosen->allocated = 1;

    /* Next Fit pointer rule:
     * After a success the pointer moves to the free remainder if the block was split,
     * else to the following block (head if none) [ASM-8]. */
    if (didSplit) {
        a->nextFit = chosen->next;
    } else {
        a->nextFit = (chosen->next != NULL) ? chosen->next : a->head;
    }
    a->nextFitOffset = a->nextFit->offset;

    a->successfulAttempts++;
    if (t != NULL) {
        a->totalSearchSteps += t->searchSteps;
    }
    a->lastFailureReason = FAIL_NONE;

    if (out != NULL) {
        *out = chosen;
    }

    assert(arenaValidate(a));
    return 0;
}

void arenaGetStats(const Arena *a, ArenaStatistics *stats) {
    if (a == NULL || stats == NULL) return;

    stats->total = a->total;
    stats->allocated = 0;
    stats->free = 0;
    stats->freeBlockCount = 0;
    stats->largestFree = 0;
    stats->smallestFree = 0;
    stats->failedAttempts = a->failedAttempts;
    stats->processesDelayed = a->processesDelayed;
    stats->searchSteps = a->totalSearchSteps;

    int minFree = a->total + 1;
    const Mab *curr = a->head;

    while (curr != NULL) {
        if (curr->allocated) {
            stats->allocated += curr->size;
        } else {
            stats->free += curr->size;
            stats->freeBlockCount++;
            if (curr->size > stats->largestFree) {
                stats->largestFree = curr->size;
            }
            if (curr->size < minFree) {
                minFree = curr->size;
            }
        }
        curr = curr->next;
    }

    if (stats->freeBlockCount > 0) {
        stats->smallestFree = minFree;
    } else {
        stats->smallestFree = 0;
    }

    stats->utilization = (stats->total > 0) ? ((double)stats->allocated / (double)stats->total * 100.0) : 0.0;

    if (stats->free == 0) {
        stats->externalFragmentation = 0.0;
        stats->isExternalFragUndefined = true;
    } else {
        stats->externalFragmentation = (1.0 - (double)stats->largestFree / (double)stats->free) * 100.0;
        stats->isExternalFragUndefined = false;
    }

    stats->largestFreePctOfTotal = (stats->total > 0) ? ((double)stats->largestFree / (double)stats->total * 100.0) : 0.0;
    stats->dragonPower = stats->externalFragmentation;

    if (stats->dragonPower < 10.0) {
        stats->dragonTier = 0; /* Sleeping */
    } else if (stats->dragonPower < 30.0) {
        stats->dragonTier = 1; /* Stirring */
    } else if (stats->dragonPower < 55.0) {
        stats->dragonTier = 2; /* Awake */
    } else if (stats->dragonPower < 80.0) {
        stats->dragonTier = 3; /* Enraged */
    } else {
        stats->dragonTier = 4; /* Inferno */
    }

    stats->cracks = (stats->freeBlockCount > 1) ? (stats->freeBlockCount - 1) : 0;
}

const char *policyToString(Policy p) {
    switch (p) {
        case POLICY_FIRST_FIT: return "first_fit";
        case POLICY_NEXT_FIT:  return "next_fit";
        case POLICY_BEST_FIT:  return "best_fit";
        case POLICY_WORST_FIT: return "worst_fit";
        default: return "unknown";
    }
}

Policy stringToPolicy(const char *str) {
    if (str == NULL) return POLICY_FIRST_FIT;
    if (strcmp(str, "first_fit") == 0 || strcmp(str, "first") == 0 || strcmp(str, "ff") == 0) return POLICY_FIRST_FIT;
    if (strcmp(str, "next_fit") == 0 || strcmp(str, "next") == 0 || strcmp(str, "nf") == 0) return POLICY_NEXT_FIT;
    if (strcmp(str, "best_fit") == 0 || strcmp(str, "best") == 0 || strcmp(str, "bf") == 0) return POLICY_BEST_FIT;
    if (strcmp(str, "worst_fit") == 0 || strcmp(str, "worst") == 0 || strcmp(str, "wf") == 0) return POLICY_WORST_FIT;
    return POLICY_FIRST_FIT;
}

const char *failureReasonToString(AllocFailureReason reason) {
    switch (reason) {
        case FAIL_NONE: return "NONE";
        case FAIL_INVALID_REQUEST: return "INVALID_REQUEST";
        case FAIL_INSUFFICIENT_TOTAL: return "INSUFFICIENT_TOTAL";
        case FAIL_NO_CONTIGUOUS_BLOCK: return "NO_CONTIGUOUS_BLOCK";
        default: return "UNKNOWN";
    }
}

const char *verdictToString(TraceVerdict verdict) {
    switch (verdict) {
        case TRACE_SKIP_ALLOCATED: return "SKIP_ALLOCATED";
        case TRACE_REJECT_TOO_SMALL: return "REJECT_TOO_SMALL";
        case TRACE_ACCEPT_FIRST_FIT: return "ACCEPT_FIRST_FIT";
        case TRACE_CANDIDATE_BEST: return "CANDIDATE_BEST";
        case TRACE_REJECT_NOT_BEST: return "REJECT_NOT_BEST";
        case TRACE_CANDIDATE_WORST: return "CANDIDATE_WORST";
        case TRACE_REJECT_NOT_LARGEST: return "REJECT_NOT_LARGEST";
        case TRACE_SELECTED: return "SELECTED";
        case TRACE_UNVISITED: return "UNVISITED";
        default: return "UNKNOWN";
    }
}
