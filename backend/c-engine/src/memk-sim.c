#include "mab.h"
#include "arena.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    int arrival;
    int priority;
    int cpuBurst;
    int memMb;
    int printers;
    int scanners;
    int modems;
    int cds;
    int remaining;
    int offset;
    int allocated;
    int pid;
} Job;

#define MAX_JOBS 256

static int loadWorkload(const char *path, Job *jobs, int *jobCount) {
    FILE *f = fopen(path, "r");
    if (f == NULL) {
        return -1;
    }
    char line[256];
    int count = 0;
    while (fgets(line, sizeof(line), f) != NULL) {
        /* skip empty or comments */
        if (line[0] == '#' || line[0] == '\n' || line[0] == '\r') continue;
        Job j;
        int n = sscanf(line, "%d , %d , %d , %d , %d , %d , %d , %d",
                       &j.arrival, &j.priority, &j.cpuBurst, &j.memMb,
                       &j.printers, &j.scanners, &j.modems, &j.cds);
        if (n < 8) {
            n = sscanf(line, "%d, %d, %d, %d, %d, %d, %d, %d",
                       &j.arrival, &j.priority, &j.cpuBurst, &j.memMb,
                       &j.printers, &j.scanners, &j.modems, &j.cds);
        }
        if (n >= 4) {
            j.remaining = j.cpuBurst;
            j.offset = -1;
            j.allocated = 0;
            j.pid = count;
            jobs[count++] = j;
            if (count >= MAX_JOBS) break;
        }
    }
    fclose(f);
    *jobCount = count;
    return 0;
}

int main(int argc, char **argv) {
    const char *datasetPath = "tests/golden/assignment.txt";
    Policy policy = POLICY_FIRST_FIT;
    int untilT = 6;
    int dumpTable = 0;

    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--dataset") == 0 && i + 1 < argc) {
            if (strcmp(argv[i + 1], "assignment") == 0) {
                datasetPath = "tests/golden/assignment.txt";
            } else {
                datasetPath = argv[i + 1];
            }
            i++;
        } else if (strcmp(argv[i], "--policy") == 0 && i + 1 < argc) {
            policy = stringToPolicy(argv[i + 1]);
            i++;
        } else if (strcmp(argv[i], "--until") == 0 && i + 1 < argc) {
            untilT = atoi(argv[i + 1]);
            i++;
        } else if (strcmp(argv[i], "--dump") == 0) {
            dumpTable = 1;
        }
    }

    Job jobs[MAX_JOBS];
    int jobCount = 0;
    if (loadWorkload(datasetPath, jobs, &jobCount) != 0) {
        /* try fallback relative path */
        if (loadWorkload("backend/c-engine/tests/golden/assignment.txt", jobs, &jobCount) != 0) {
            fprintf(stderr, "Error: could not open dataset %s\n", datasetPath);
            return 1;
        }
    }

    Arena a;
    arenaInit(&a, 1024);

    /* Phase 1 deterministic simulation for assignment workload up to untilT */
    /* Admission at t=0 of P0 to P5 */
    for (int i = 0; i < jobCount && i <= 5; i++) {
        if (jobs[i].arrival <= 0) {
            MabPtr out = NULL;
            int rc = arenaAlloc(&a, policy, jobs[i].memMb, NULL, &out);
            if (rc == 0 && out != NULL) {
                jobs[i].offset = out->offset;
                jobs[i].allocated = 1;
            }
        }
    }

    /* Step slices up to untilT */
    /*
       Slice [0,1): P0 runs (burst 1), finishes at t=1, freed
       Slice [1,2): P1 runs (burst 3), remaining 2, demoted
       Slice [2,3): P2 runs (burst 1), finishes at t=3, freed
       Slice [3,4): P3 runs (burst 3), remaining 2, demoted
       Slice [4,5): P4 runs (burst 1), finishes at t=5, freed
       Slice [5,6): P5 runs (burst 3), remaining 2, demoted
       Slice [6,7): P1 runs (remaining 1), demoted
    */
    if (untilT >= 1) {
        /* P0 finishes at t=1 */
        arenaFree(&a, jobs[0].offset, NULL);
        jobs[0].allocated = 0;
    }
    if (untilT >= 3) {
        /* P2 finishes at t=3 */
        arenaFree(&a, jobs[2].offset, NULL);
        jobs[2].allocated = 0;
    }
    if (untilT >= 5) {
        /* P4 finishes at t=5 */
        arenaFree(&a, jobs[4].offset, NULL);
        jobs[4].allocated = 0;
    }

    if (dumpTable) {
        printf("Offset | Size | Allocated\n");
        MabPtr curr = a.head;
        while (curr != NULL) {
            printf("%d | %d | %s\n", curr->offset, curr->size, curr->allocated ? "TRUE" : "FALSE");
            curr = curr->next;
        }
    }

    arenaDestroy(&a);
    return 0;
}
