#include "protocol.h"
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

/* Simple, robust JSON token/field extractor (safe against malformed inputs) */
static const char *skipWhitespace(const char *s) {
    while (*s && isspace((unsigned char)*s)) s++;
    return s;
}

static bool extractStringField(const char *json, const char *key, char *out, size_t outSize) {
    char pattern[64];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *p = strstr(json, pattern);
    if (!p) return false;
    p += strlen(pattern);
    p = skipWhitespace(p);
    if (*p != ':') return false;
    p++;
    p = skipWhitespace(p);
    if (*p != '"') return false;
    p++;
    size_t i = 0;
    while (*p && *p != '"' && i + 1 < outSize) {
        if (*p == '\\' && *(p + 1)) p++;
        out[i++] = *p++;
    }
    out[i] = '\0';
    return true;
}

static bool extractIntField(const char *json, const char *key, int *out) {
    char pattern[64];
    snprintf(pattern, sizeof(pattern), "\"%s\"", key);
    const char *p = strstr(json, pattern);
    if (!p) return false;
    p += strlen(pattern);
    p = skipWhitespace(p);
    if (*p != ':') return false;
    p++;
    p = skipWhitespace(p);
    char *end = NULL;
    long val = strtol(p, &end, 10);
    if (p == end) return false;
    *out = (int)val;
    return true;
}

/* Event forwarding */
typedef struct {
    FILE *outStream;
} ProtocolEventContext;

static void protocolEventCb(int seq, int t, const char *kind, const char *jsonData, void *userData) {
    ProtocolEventContext *ctx = (ProtocolEventContext *)userData;
    if (ctx != NULL && ctx->outStream != NULL) {
        fprintf(ctx->outStream, "{\"type\":\"event\",\"seq\":%d,\"t\":%d,\"kind\":\"%s\",\"data\":%s}\n",
                seq, t, kind, jsonData ? jsonData : "{}");
        fflush(ctx->outStream);
    }
}

static void emitSnapshotJson(const Scheduler *s, FILE *f) {
    ArenaStatistics st;
    arenaGetStats(&s->arena, &st);

    fprintf(f, "{\"t\":%d,\"seq\":%d,\"runningPid\":%d,\"isFinished\":%s,",
            s->t, s->seq, s->runningPid, s->isFinished ? "true" : "false");

    /* Queues */
    fprintf(f, "\"queues\":{");
    fprintf(f, "\"input\":[");
    int idx = s->inputQueue.head;
    for (int i = 0; i < s->inputQueue.count; i++) {
        fprintf(f, "%s%d", (i > 0 ? "," : ""), s->inputQueue.pids[idx]);
        idx = (idx + 1) % MAX_QUEUE_SIZE;
    }
    fprintf(f, "],\"userJob\":[");
    idx = s->userJobQueue.head;
    for (int i = 0; i < s->userJobQueue.count; i++) {
        fprintf(f, "%s%d", (i > 0 ? "," : ""), s->userJobQueue.pids[idx]);
        idx = (idx + 1) % MAX_QUEUE_SIZE;
    }
    fprintf(f, "],\"q1\":[");
    idx = s->feedbackQ1.head;
    for (int i = 0; i < s->feedbackQ1.count; i++) {
        fprintf(f, "%s%d", (i > 0 ? "," : ""), s->feedbackQ1.pids[idx]);
        idx = (idx + 1) % MAX_QUEUE_SIZE;
    }
    fprintf(f, "],\"q2\":[");
    idx = s->feedbackQ2.head;
    for (int i = 0; i < s->feedbackQ2.count; i++) {
        fprintf(f, "%s%d", (i > 0 ? "," : ""), s->feedbackQ2.pids[idx]);
        idx = (idx + 1) % MAX_QUEUE_SIZE;
    }
    fprintf(f, "],\"q3\":[");
    idx = s->feedbackQ3.head;
    for (int i = 0; i < s->feedbackQ3.count; i++) {
        fprintf(f, "%s%d", (i > 0 ? "," : ""), s->feedbackQ3.pids[idx]);
        idx = (idx + 1) % MAX_QUEUE_SIZE;
    }
    fprintf(f, "]},");

    /* Arena */
    fprintf(f, "\"arena\":{\"total\":%d,\"nextFitOffset\":%d,\"blocks\":[",
            s->arena.total, s->arena.nextFitOffset);
    const Mab *b = s->arena.head;
    bool firstBlock = true;
    while (b != NULL) {
        int pid = -1;
        if (b->allocated) {
            pid = schedulerGetProcessPidByOffset(s, b->offset);
        }
        fprintf(f, "%s{\"offset\":%d,\"size\":%d,\"allocated\":%s,\"pid\":%d}",
                firstBlock ? "" : ",", b->offset, b->size, b->allocated ? "true" : "false", pid);
        firstBlock = false;
        b = b->next;
    }
    fprintf(f, "],\"statistics\":{\"total\":%d,\"allocated\":%d,\"free\":%d,\"freeBlockCount\":%d,\"largestFree\":%d,\"smallestFree\":%d,\"utilization\":%.2f,\"externalFragmentation\":%.2f,\"isExternalFragUndefined\":%s,\"largestFreePctOfTotal\":%.2f,\"failedAttempts\":%d,\"processesDelayed\":%d,\"searchSteps\":%d,\"dragonPower\":%.2f,\"dragonTier\":%d,\"cracks\":%d}},",
            st.total, st.allocated, st.free, st.freeBlockCount, st.largestFree, st.smallestFree,
            st.utilization, st.externalFragmentation, st.isExternalFragUndefined ? "true" : "false",
            st.largestFreePctOfTotal, st.failedAttempts, st.processesDelayed, st.searchSteps,
            st.dragonPower, st.dragonTier, st.cracks);

    /* Processes */
    fprintf(f, "\"processes\":[");
    for (int i = 0; i < s->processCount; i++) {
        const Process *p = &s->processes[i];
        fprintf(f, "%s{\"pid\":%d,\"name\":\"%s\",\"arrival\":%d,\"priority\":%d,\"cpuBurst\":%d,\"remaining\":%d,\"memMb\":%d,\"offset\":%d,\"state\":\"%s\",\"queueLevel\":%d,\"admittedTime\":%d,\"finishTime\":%d,\"waitedForMemory\":%d}",
                i > 0 ? "," : "", p->pid, p->name, p->arrival, p->priority, p->cpuBurst,
                p->remaining, p->memMb, p->offset, processStateToString(p->state),
                p->queueLevel, p->admittedTime, p->finishTime, p->waitedForMemoryTicks);
    }
    fprintf(f, "]}");
}

void protocolSessionInit(ProtocolSession *ps) {
    if (ps == NULL) return;
    SchedulerConfig cfg = {
        .policy = POLICY_FIRST_FIT,
        .quantum = 1,
        .totalMemory = 1024,
        .demotionTrigger = DEMOTE_ALWAYS,
        .admissionOrdering = ADMISSION_FIFO_BLOCK
    };
    schedulerInit(&ps->scheduler, &cfg, NULL);
    ps->isConfigured = true;
    ps->snapshotHistoryCap = 500;
}

void protocolSessionDestroy(ProtocolSession *ps) {
    if (ps == NULL) return;
    schedulerDestroy(&ps->scheduler);
}

int protocolProcessLine(ProtocolSession *ps, const char *line, FILE *outStream) {
    if (ps == NULL || line == NULL || outStream == NULL) return -1;

    ProtocolEventContext evtCtx = { .outStream = outStream };
    schedulerSetEventCallback(&ps->scheduler, protocolEventCb, &evtCtx);

    char cmd[64] = {0};
    int id = 0;
    extractIntField(line, "id", &id);
    if (!extractStringField(line, "cmd", cmd, sizeof(cmd))) {
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":false,\"error\":\"Missing or invalid 'cmd'\"}\n", id);
        fflush(outStream);
        return 0;
    }

    if (strcmp(cmd, "session.configure") == 0) {
        char polStr[32] = {0};
        int q = 1;
        int tot = 1024;
        SchedulerConfig cfg = ps->scheduler.config;
        if (extractStringField(line, "policy", polStr, sizeof(polStr))) {
            cfg.policy = stringToPolicy(polStr);
        }
        if (extractIntField(line, "quantum", &q) && q > 0) {
            cfg.quantum = q;
        }
        if (extractIntField(line, "totalMemory", &tot) && tot > 0) {
            cfg.totalMemory = tot;
        }
        char demoteStr[32] = {0};
        if (extractStringField(line, "demotionTrigger", demoteStr, sizeof(demoteStr))) {
            if (strcmp(demoteStr, "only-if-contended") == 0) cfg.demotionTrigger = DEMOTE_ONLY_IF_CONTENDED;
            else cfg.demotionTrigger = DEMOTE_ALWAYS;
        }
        char admitStr[32] = {0};
        if (extractStringField(line, "admissionOrdering", admitStr, sizeof(admitStr))) {
            if (strcmp(admitStr, "skip-ahead") == 0) cfg.admissionOrdering = ADMISSION_SKIP_AHEAD;
            else cfg.admissionOrdering = ADMISSION_FIFO_BLOCK;
        }

        schedulerDestroy(&ps->scheduler);
        schedulerInit(&ps->scheduler, &cfg, NULL);

        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"policy\":\"%s\",\"quantum\":%d,\"totalMemory\":%d}}\n",
                id, policyToString(cfg.policy), cfg.quantum, cfg.totalMemory);
    } else if (strcmp(cmd, "workload.assignment") == 0) {
        schedulerReset(&ps->scheduler);
        schedulerLoadAssignmentDataset(&ps->scheduler);
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"jobCount\":%d}}\n",
                id, ps->scheduler.processCount);
    } else if (strcmp(cmd, "workload.random") == 0) {
        int seed = 1234;
        int n = 8;
        extractIntField(line, "seed", &seed);
        extractIntField(line, "n", &n);
        if (n < 1) n = 1;
        if (n > 64) n = 64;

        srand((unsigned int)seed);
        Process randomProcs[64];
        for (int i = 0; i < n; i++) {
            randomProcs[i].arrival = rand() % 10;
            randomProcs[i].priority = 1 + (rand() % 3);
            randomProcs[i].cpuBurst = 1 + (rand() % 5);
            randomProcs[i].memMb = 16 + (rand() % 240);
            randomProcs[i].printers = 0;
            randomProcs[i].scanners = 0;
            randomProcs[i].modems = 0;
            randomProcs[i].cds = 0;
        }

        schedulerReset(&ps->scheduler);
        schedulerLoadWorkload(&ps->scheduler, randomProcs, n);
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"jobCount\":%d,\"seed\":%d}}\n",
                id, n, seed);
    } else if (strcmp(cmd, "sim.tick") == 0) {
        bool progressed = schedulerTick(&ps->scheduler);
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"t\":%d,\"isFinished\":%s,\"progressed\":%s}}\n",
                id, ps->scheduler.t, ps->scheduler.isFinished ? "true" : "false", progressed ? "true" : "false");
    } else if (strcmp(cmd, "sim.run") == 0) {
        int untilT = -1;
        extractIntField(line, "untilT", &untilT);
        schedulerRun(&ps->scheduler, untilT);
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"t\":%d,\"isFinished\":%s}}\n",
                id, ps->scheduler.t, ps->scheduler.isFinished ? "true" : "false");
    } else if (strcmp(cmd, "sim.reset") == 0) {
        schedulerReset(&ps->scheduler);
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"t\":0}}\n", id);
    } else if (strcmp(cmd, "snapshot.get") == 0) {
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":", id);
        emitSnapshotJson(&ps->scheduler, outStream);
        fprintf(outStream, "}\n");
    } else if (strcmp(cmd, "arena.alloc") == 0) {
        int pid = -1;
        int size = 0;
        extractIntField(line, "pid", &pid);
        extractIntField(line, "size", &size);

        Trace tr;
        MabPtr outBlock = NULL;
        int rc = arenaAlloc(&ps->scheduler.arena, ps->scheduler.config.policy, size, &tr, &outBlock);
        if (rc == 0 && outBlock != NULL) {
            if (pid >= 0) {
                offsetTableSet(&ps->scheduler.pidTable, outBlock->offset, pid);
            }
            fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"offset\":%d,\"size\":%d}}\n",
                    id, outBlock->offset, outBlock->size);
        } else {
            fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":false,\"error\":\"%s\"}\n",
                    id, failureReasonToString(ps->scheduler.arena.lastFailureReason));
        }
    } else if (strcmp(cmd, "arena.free") == 0) {
        int pid = -1;
        int offset = -1;
        extractIntField(line, "pid", &pid);
        extractIntField(line, "offset", &offset);

        if (offset < 0 && pid >= 0) {
            for (int i = 0; i < ps->scheduler.pidTable.count; i++) {
                if (ps->scheduler.pidTable.mappings[i].pid == pid) {
                    offset = ps->scheduler.pidTable.mappings[i].offset;
                    break;
                }
            }
        }

        if (offset >= 0) {
            FreeInfo info;
            int rc = arenaFree(&ps->scheduler.arena, offset, &info);
            if (rc == 0) {
                offsetTableRemove(&ps->scheduler.pidTable, offset);
                fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"freedOffset\":%d,\"freedSize\":%d,\"survivingOffset\":%d,\"survivingSize\":%d}}\n",
                        id, info.freedOffset, info.freedSize, info.survivingOffset, info.survivingSize);
            } else {
                fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":false,\"error\":\"arenaFree failed\"}\n", id);
            }
        } else {
            fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":false,\"error\":\"Process or offset not found\"}\n", id);
        }
    } else if (strcmp(cmd, "compare.run") == 0) {
        PolicyCompareResult results[4];
        schedulerCompareRun(ps->scheduler.processes, ps->scheduler.processCount, &ps->scheduler.config, results);

        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":true,\"data\":{\"results\":[", id);
        for (int p = 0; p < 4; p++) {
            fprintf(outStream, "%s{\"policy\":\"%s\",\"successfulAttempts\":%d,\"failedAttempts\":%d,\"processesDelayed\":%d,\"totalFree\":%d,\"largestFree\":%d,\"freeBlockCount\":%d,\"utilization\":%.2f,\"externalFragmentation\":%.2f,\"totalSearchSteps\":%d,\"avgMemoryWait\":%.2f,\"avgTurnaround\":%.2f,\"makespan\":%d}",
                    p > 0 ? "," : "", policyToString(results[p].policy),
                    results[p].successfulAttempts, results[p].failedAttempts, results[p].processesDelayed,
                    results[p].totalFree, results[p].largestFree, results[p].freeBlockCount,
                    results[p].utilization, results[p].externalFragmentation, results[p].totalSearchSteps,
                    results[p].avgMemoryWait, results[p].avgTurnaround, results[p].makespan);
        }
        fprintf(outStream, "]}}\n");
    } else {
        fprintf(outStream, "{\"type\":\"reply\",\"id\":%d,\"ok\":false,\"error\":\"Unknown command '%s'\"}\n", id, cmd);
    }

    fflush(outStream);
    return 0;
}

void protocolRunLoop(ProtocolSession *ps, FILE *inStream, FILE *outStream) {
    char *line = (char *)malloc(MAX_LINE_BUFFER);
    if (!line) return;

    while (fgets(line, MAX_LINE_BUFFER, inStream) != NULL) {
        /* Trim trailing newline */
        size_t len = strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r')) {
            line[--len] = '\0';
        }
        if (len == 0) continue;

        protocolProcessLine(ps, line, outStream);
    }

    free(line);
}
