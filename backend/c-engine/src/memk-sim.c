#include "mab.h"
#include "arena.h"
#include "scheduler.h"
#include "protocol.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    const char *datasetPath = "tests/golden/assignment.txt";
    Policy policy = POLICY_FIRST_FIT;
    int untilT = 6;
    int dumpTable = 0;
    int serverMode = 0;

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
        } else if (strcmp(argv[i], "--server") == 0) {
            serverMode = 1;
        }
    }

    if (serverMode || (argc == 1)) {
        /* Run JSON Lines protocol server on stdin / stdout */
        ProtocolSession session;
        protocolSessionInit(&session);
        protocolRunLoop(&session, stdin, stdout);
        protocolSessionDestroy(&session);
        return 0;
    }

    /* CLI Mode: run scheduler up to untilT and dump table */
    Scheduler s;
    SchedulerConfig cfg = {
        .policy = policy,
        .quantum = 1,
        .totalMemory = 1024,
        .demotionTrigger = DEMOTE_ALWAYS,
        .admissionOrdering = ADMISSION_FIFO_BLOCK
    };
    schedulerInit(&s, &cfg, NULL);

    /* Try loading dataset */
    if (schedulerLoadAssignmentDataset(&s) != 0) {
        fprintf(stderr, "Error loading dataset: %s\n", datasetPath);
        schedulerDestroy(&s);
        return 1;
    }

    schedulerRun(&s, untilT);

    if (dumpTable) {
        printf("Offset | Size | Allocated\n");
        MabPtr curr = s.arena.head;
        while (curr != NULL) {
            printf("%d | %d | %s\n", curr->offset, curr->size, curr->allocated ? "TRUE" : "FALSE");
            curr = curr->next;
        }
    }

    schedulerDestroy(&s);
    return 0;
}
