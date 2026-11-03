#ifndef MEMK_PROTOCOL_H
#define MEMK_PROTOCOL_H

#include "scheduler.h"
#include <stdio.h>

#define MAX_LINE_BUFFER (1024 * 1024) /* 1 MB per line limit */

typedef struct {
    Scheduler scheduler;
    bool isConfigured;
    int snapshotHistoryCap;
} ProtocolSession;

void protocolSessionInit(ProtocolSession *ps);
void protocolSessionDestroy(ProtocolSession *ps);

/* Process a single incoming JSON command line, write response / events to outStream */
int protocolProcessLine(ProtocolSession *ps, const char *line, FILE *outStream);

/* Run interactive loop on inStream and outStream */
void protocolRunLoop(ProtocolSession *ps, FILE *inStream, FILE *outStream);

#endif /* MEMK_PROTOCOL_H */
