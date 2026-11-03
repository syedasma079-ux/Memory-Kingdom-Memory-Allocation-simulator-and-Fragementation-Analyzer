# Original Assignment Specification: Memory Allocation & Feedback Dispatcher

## 1. Memory Allocation Overview

In this project you need to implement **Best Fit**, **First Fit**, **Next Fit**, or **Worst Fit** memory allocation policy. The memory is described as a structure in a doubly linked list:

```c
struct mab {
    int offset;
    int size;
    int allocated;
    struct mab * next;
    struct mab * prev;
};
typedef struct mab Mab;
typedef Mab * MabPtr;
```

Function prototypes required:

```c
MabPtr memChk(MabPtr m, int size);     // check if memory available
MabPtr memAlloc(MabPtr m, int size);   // allocate memory block
MabPtr memFree(MabPtr m);             // free memory block
MabPtr memMerge(MabPtr m);            // merge two memory blocks
MabPtr memSplit(MabPtr m, int size);  // split a memory block
```

### Allocation & Deallocation Semantics
- **Allocating memory**: A process of finding a block of 'free' memory big enough to hold the requested memory block. The free block is then split (if necessary) with the right size block marked as 'allocated' and the remaining block (if any) marked as 'free'.
- **Freeing memory**: Done by changing the flag on the block to 'free'. After this the blocks on both sides of the newly 'freed' block are examined. If either (or both of them are 'free') the 'free' blocks must be merged together to form just one 'free' block.
- **Reverse Link**: The `mab` structure is constructed with a reverse link as well as a forward link. This makes it easier to check for adjacent unallocated blocks that need to be merged when freeing up a memory block.

---

## 2. Feedback Dispatcher Logic with Memory Allocation

Processes are passed from the input queue (Job Dispatch List) to the Feedback pending queue (User Job Queue) when they have "arrived". They are dequeued and enlisted on the appropriate Feedback queue when sufficient memory is available for them in the memory arena - the memory is allocated when they are enqueued and deallocated when they are terminated.

### Logic:
1. Initialize dispatcher queues (input queue, user job queue, and feedback queues);
2. Fill input queue from dispatch list file;
3. Start dispatcher timer (`dispatcher timer = 0`);
4. While there's anything in any of the queues or there is a currently running process:
   i. **Unload pending processes from the input queue:**
      ```
      While (head-of-input-queue.arrival-time <= dispatcher timer)
          dequeue process from input queue and enqueue on user job queue;
      ```
   ii. **Unload pending processes from the user job queue:**
      ```
      While (head-of-user-job-queue.mbytes can be allocated)
          dequeue process from user job queue, allocate memory to the process and enqueue on highest priority feedback queue (assigning it the appropriate priority);
      ```
   iii. **If a process is currently running:**
      a. Decrement process `remainingcputime`;
      b. If times up:
         A. Send `SIGINT` to the process to terminate it;
         B. Free memory allocated to the process;
         C. Free up process structure memory;
      c. Else if other processes are waiting in any of the feedback queues:
         A. Send `SIGTSTP` to suspend it;
         B. Reduce the priority of the process (if possible) and enqueue it on the appropriate feedback queue;
   iv. **If no process currently running && feedback queues are not all empty:**
      a. Dequeue a process from the highest priority feedback queue that is not empty;
      b. If already started but suspended, restart it (send `SIGCONT` to it), else start it (`fork` & `exec`);
      c. Set it as currently running process;
   v. Sleep for one second;
   vi. Increment dispatcher timer;
   vii. Go back to 4.
5. Exit.

---

## 3. Assignment Test Workload & Expected Results

Job list with quantum = 1 sec and available memory = 1024 Mbyte:

```text
0, 1, 1, 192, 0, 0, 0, 0
0, 1, 3, 32, 0, 0, 0, 0
0, 1, 1, 416, 0, 0, 0, 0
0, 1, 3, 32, 0, 0, 0, 0
0, 1, 1, 160, 0, 0, 0, 0
0, 1, 3, 128, 0, 0, 0, 0
7, 1, 2, 108, 0, 0, 0, 0
7, 1, 2, 256, 0, 0, 0, 0
7, 1, 2, 80, 0, 0, 0, 0
```

Runs processes 0-5 in the first 6 seconds and leaves the memory arena at t = 6 as:
```text
offset  size  allocated
0       192   FALSE
192     32    TRUE
224     416   FALSE
640     32    TRUE
672     160   FALSE
832     128   TRUE
960     64    FALSE
```
with the Next Fit pointer at offset 960 (for all 4 policies).

At t = 7, processes 6, 7, and 8 (108 MB, 256 MB, 80 MB) are admitted and allocated:
- **First Fit**: P6 at 0, P7 at 224, P8 at 108.
- **Next Fit**: P6 at 0, P7 at 224, P8 at 480.
- **Best Fit**: P6 at 672, P7 at 224, P8 at 480.
- **Worst Fit**: P6 at 224, P7 at 332, P8 at 0.
