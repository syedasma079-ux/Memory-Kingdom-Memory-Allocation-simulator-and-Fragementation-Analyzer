#include "protocol.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define FUZZ_ITERATIONS 500

static const char *malformed_cases[] = {
    "",
    "   ",
    "{",
    "}",
    "{\"cmd\":}",
    "{\"id\":\"notanumber\"}",
    "{\"cmd\":\"unknown.command\"}",
    "{\"cmd\":\"session.configure\",\"policy\":\"invalid_policy\"}",
    "{\"cmd\":\"arena.alloc\",\"size\":-9999}",
    "{\"cmd\":\"arena.alloc\",\"size\":99999999}",
    "{\"cmd\":\"arena.free\",\"pid\":-50}",
    "{\"cmd\":\"arena.free\",\"offset\":-100}",
    "{\"cmd\":\"sim.run\",\"untilT\":-5}",
    "{\"cmd\":\"workload.random\",\"n\":-10,\"seed\":-5}",
    "{\"id\":1234,\"cmd\":\"sim.seek\",\"seq\":-1}",
    "{\"cmd\":12345}",
    "{\"cmd\":null}",
    "{\"nested\":{\"broken\":true}",
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "{\"cmd\":\"arena.alloc\",\"size\":\"string_instead_of_int\"}"
};

int main(void) {
    setvbuf(stdout, NULL, _IONBF, 0);
    printf("===========================================\n");
    printf(" MEMORY KINGDOM: Protocol Fuzzer           \n");
    printf("===========================================\n");

    ProtocolSession ps;
    protocolSessionInit(&ps);

    FILE *devNull = fopen("/dev/null", "w");
    if (!devNull) devNull = tmpfile();

    /* 1. Test static malformed test cases */
    size_t numCases = sizeof(malformed_cases) / sizeof(malformed_cases[0]);
    for (size_t i = 0; i < numCases; i++) {
        printf("Testing case %zu: %s\n", i, malformed_cases[i]);
        fflush(stdout);
        protocolProcessLine(&ps, malformed_cases[i], devNull);
    }
    printf("Static malformed cases (%zu): PASSED without crash\n", numCases);

    /* 2. Seeded random garbage fuzzer */
    srand(4242);
    char buf[1024];
    for (int iter = 0; iter < FUZZ_ITERATIONS; iter++) {
        int len = 1 + (rand() % (sizeof(buf) - 2));
        for (int k = 0; k < len; k++) {
            buf[k] = (char)(32 + (rand() % 95)); /* printable ascii */
        }
        buf[len] = '\0';
        protocolProcessLine(&ps, buf, devNull);
    }
    printf("Randomized ASCII fuzzing (%d iterations): PASSED without crash\n", FUZZ_ITERATIONS);

    fclose(devNull);
    protocolSessionDestroy(&ps);

    printf("===========================================\n");
    printf("Protocol Fuzzer: ALL CHECKS PASSED\n");
    printf("===========================================\n");
    return 0;
}
