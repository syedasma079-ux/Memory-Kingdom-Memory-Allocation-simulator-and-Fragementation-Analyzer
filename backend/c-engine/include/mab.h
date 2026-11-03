#ifndef MEMK_MAB_H
#define MEMK_MAB_H

#include <stddef.h>

struct mab {
    int offset;
    int size;
    int allocated;
    struct mab *next;
    struct mab *prev;
};

typedef struct mab Mab;
typedef Mab *MabPtr;

/* Required functions with exact signatures from academic specification */
MabPtr memChk(MabPtr m, int size);
MabPtr memAlloc(MabPtr m, int size);
MabPtr memFree(MabPtr m);
MabPtr memMerge(MabPtr m);
MabPtr memSplit(MabPtr m, int size);

#endif /* MEMK_MAB_H */
