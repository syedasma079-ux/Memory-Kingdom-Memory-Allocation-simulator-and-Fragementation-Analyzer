#include "mab.h"
#include <stdlib.h>

MabPtr memChk(MabPtr m, int size) {
    if (size <= 0) return NULL;
    MabPtr curr = m;
    while (curr != NULL) {
        if (!curr->allocated && curr->size >= size) {
            return curr;
        }
        curr = curr->next;
    }
    return NULL;
}

MabPtr memSplit(MabPtr m, int size) {
    if (m == NULL || m->allocated || size <= 0 || size > m->size) {
        return NULL;
    }
    if (size == m->size) {
        return m;
    }

    MabPtr rem = (MabPtr)malloc(sizeof(Mab));
    if (rem == NULL) {
        return NULL;
    }

    rem->offset = m->offset + size;
    rem->size = m->size - size;
    rem->allocated = 0;
    rem->prev = m;
    rem->next = m->next;

    if (m->next != NULL) {
        m->next->prev = rem;
    }
    m->next = rem;
    m->size = size;

    return m;
}

MabPtr memMerge(MabPtr m) {
    if (m == NULL || m->allocated) {
        return m;
    }

    /* First, check adjacent next block */
    if (m->next != NULL && !m->next->allocated) {
        MabPtr victim = m->next;
        m->size += victim->size;
        m->next = victim->next;
        if (victim->next != NULL) {
            victim->next->prev = m;
        }
        free(victim);
    }

    /* Next, check adjacent prev block.
     * The surviving block is the lowest-address one (prev). */
    if (m->prev != NULL && !m->prev->allocated) {
        MabPtr survivor = m->prev;
        survivor->size += m->size;
        survivor->next = m->next;
        if (m->next != NULL) {
            m->next->prev = survivor;
        }
        free(m);
        m = survivor;
    }

    return m;
}

MabPtr memFree(MabPtr m) {
    if (m == NULL) return NULL;
    m->allocated = 0;
    return memMerge(m);
}

MabPtr memAlloc(MabPtr m, int size) {
    if (size <= 0) return NULL;
    MabPtr block = memChk(m, size);
    if (block == NULL) return NULL;

    if (block->size > size) {
        memSplit(block, size);
    }
    block->allocated = 1;
    return block;
}
