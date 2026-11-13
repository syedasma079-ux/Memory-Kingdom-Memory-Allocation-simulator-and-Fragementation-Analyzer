# Allocation Algorithms & Complexity

MEMORY KINGDOM implements all four fundamental dynamic memory allocation policies specified in Operating Systems literature. All four algorithms operate directly on the memory arena doubly-linked list.

---

## 1. First Fit (`first_fit`) — Swift Rangers
- **Strategy**: Scans the block list starting from the list head (`a->head`), examining each block sequentially.
- **Selection**: Allocates the very first free block encountered with `size >= requested`.
- **Splitting**: If `size < block->size`, the low address region `[offset, offset + size)` is marked allocated, and a free remainder `[offset + size, offset + block->size)` is inserted immediately after it.
- **Ties / Wraparound**: Not applicable (stops on first match).
- **Time Complexity**: $O(N)$ worst case (when the fitting hole is near the tail or absent); typically faster than a full scan.
- **Characteristics**: Fast, tends to accumulate small fragmented blocks at the beginning of the arena.

---

## 2. Next Fit (`next_fit`) — Wandering Knights
- **Strategy**: Scans starting from the persistent Next Fit pointer (`a->nextFit`), walking circularly across the linked list.
- **Start Rule [DER / ASM-8]**: Starts search AT the pointed block (inclusive). If the end of the list is reached, it wraps around to the head and continues up to the starting block (each block examined at most once).
- **Persistent Pointer**: The pointer is maintained across allocations. If a block is split, the pointer moves to the newly created free remainder; if an exact fit occurs, it advances to the following block (or wraps to head). If allocation fails, the pointer remains unchanged.
- **Pointer Safety [ENG]**: When blocks are merged via `arenaFree` or `arenaMerge`, any pointer referencing an absorbed block is safely repaired to point to the surviving block *before* `memFree` is invoked.
- **Time Complexity**: $O(N)$ worst case.
- **Characteristics**: Distributes allocations throughout the entire address space, avoiding clustering at the front, but may leave fragmented holes scattered across memory.

---

## 3. Best Fit (`best_fit`) — Precision Architects
- **Strategy**: Performs a complete scan of the entire linked list without early exit.
- **Selection**: Identifies the free block whose `size >= requested` has the *smallest* capacity (i.e., minimizes `block->size - requested`).
- **Tie-Breaking [ASM-10]**: If multiple blocks share the exact same minimum fitting size, the tie is broken in favor of the block with the lowest offset.
- **Time Complexity**: $O(N)$ always (full scan required).
- **Characteristics**: Preserves larger contiguous free blocks for future requests, but frequently creates tiny residual fragments ("cracks").

---

## 4. Worst Fit (`worst_fit`) — Giant Keepers
- **Strategy**: Performs a complete scan of the entire linked list without early exit.
- **Selection**: Identifies the free block that is the *largest* in the entire arena, provided its `size >= requested`.
- **Tie-Breaking [ASM-10]**: If multiple candidate blocks have the same maximum size, ties go to the lowest offset.
- **Time Complexity**: $O(N)$ always (full scan required).
- **Characteristics**: Leaves behind the largest possible remainder after splitting, which may remain useful for subsequent allocations, but can rapidly degrade the largest available memory chunks.

---

## 5. Comparative Performance Summary

On the reference assignment workload (P0–P8, 1024 MB):
- At $t=6$, all four policies produce identical layouts (**G1**) because the initial allocations see a single contiguous free tail.
- At $t=7$, when P6, P7, and P8 arrive simultaneously after P0, P2, and P4 have completed:
  - **First Fit**: P6 $\rightarrow$ offset 0, P7 $\rightarrow$ offset 224, P8 $\rightarrow$ offset 108.
  - **Next Fit**: P6 $\rightarrow$ offset 0, P7 $\rightarrow$ offset 224, P8 $\rightarrow$ offset 480 (Next Fit pointer at 560).
  - **Best Fit**: P6 $\rightarrow$ offset 672, P7 $\rightarrow$ offset 224, P8 $\rightarrow$ offset 480.
  - **Worst Fit**: P6 $\rightarrow$ offset 224, P7 $\rightarrow$ offset 332, P8 $\rightarrow$ offset 0.
- All derived layouts match **G2** and **G3** exactly.

