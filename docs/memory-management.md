# Memory Management & Pointer Safety

## 1. Verbatim Academic Structure & Primitives

The core block representation strictly adheres to the course assignment definition:

```c
struct mab {
    int offset;
    int size;
    int allocated;
    struct mab *next;
    struct mab *prev;
};
typedef struct mab Mab;
typedef Mab *MabPtr;
```

The five academic primitives are implemented with their exact required C function signatures:
1. `MabPtr memChk(MabPtr m, int size)`: Read-only probe. Returns the first block from list head `m` with `size >= requested`, or `NULL`. Mutates nothing.
2. `MabPtr memAlloc(MabPtr m, int size)`: First Fit allocation on a bare list; returns the allocated block or `NULL`.
3. `MabPtr memFree(MabPtr m)`: Marks block `m` free, calls `memMerge(m)`, and returns the surviving merged block.
4. `MabPtr memMerge(MabPtr m)`: Merges free block `m` with an immediately adjacent free `next`, then with an adjacent free `prev`. Absorbed nodes are safely freed with `free()`.
5. `MabPtr memSplit(MabPtr m, int size)`: Splits a free block `m` (`0 < size < m->size`) into an allocated low block of size `size` and a free remainder block at `offset + size`.

---

## 2. Arena Layer & Pointer Safety

The `Arena` structure maintains the arena head, total size, Next Fit persistent pointer, and statistical counters:

```c
typedef struct {
    MabPtr head;
    int total;
    MabPtr nextFit;
    int nextFitOffset;
    ArenaStats stats;
} Arena;
```

### Pre-Merge Pointer Repair Algorithm
Because `memMerge` deallocates absorbed heap nodes, any external reference (specifically `a->nextFit`) pointing to a block about to be absorbed would become a dangling pointer. `arenaFree` repairs this pointer **before** calling `memFree`:

1. Locate block `b` with `b->offset == offset`. Return an error if not found or already free (prevents double frees).
2. Predict merge partners without mutating:
   - `prevFree = b->prev && !b->prev->allocated`
   - `nextFree = b->next && !b->next->allocated`
   - `survivor = prevFree ? b->prev : b`
   - `absorbed = (prevFree ? {b} : {}) U (nextFree ? {b->next} : {})`
3. If `a->nextFit` matches any node in `absorbed`, update `a->nextFit = survivor` and synchronize `nextFitOffset`.
4. Call `memFree(b)` and assert the returned block equals `survivor`.
5. If `survivor->offset == 0`, update `a->head = survivor`.

---

## 3. Invariants & Statistics

### Invariant Checks (`arenaValidate`)
Executed after every mutation in test builds and when `MEMK_PARANOID=1`:
- First block starts at offset 0.
- Every block begins exactly where the previous ends (`curr->offset == prev->offset + prev->size`).
- Every block has `size > 0`.
- Block status is binary (`allocated == 0` or `1`).
- Sum of all block sizes equals `total` (1024 MB).
- Allocated blocks never overlap.
- Prev and next links are symmetric (`curr->next->prev == curr`).
- No two adjacent free blocks exist (coalescing invariant).
- `a->nextFit != NULL` and is reachable by walking from `a->head`.

### Fragmentation & The Dragon Formula
- $\text{utilization} = (\text{allocatedMB} / \text{totalMB}) \times 100$
- $\text{externalFragmentation} = (1 - \text{largestFree} / \text{totalFree}) \times 100$ (defined as 0 when `totalFree == 0`).
- $\text{dragonPower} = \text{externalFragmentation}$.
- $\text{dragonTier}$:
  - Tier 0: Sleeping ($< 10\%$)
  - Tier 1: Stirring ($10\% \le \text{frag} < 30\%$)
  - Tier 2: Awake ($30\% \le \text{frag} < 55\%$)
  - Tier 3: Enraged ($55\% \le \text{frag} < 80\%$)
  - Tier 4: Inferno ($\ge 80\%$)
- $\text{cracks} = \max(0, \text{freeBlockCount} - 1)$.

