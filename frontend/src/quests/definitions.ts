import type { EngineEvent, EngineSnapshot } from '../types/engine';

export interface QuestContext {
  events: EngineEvent[];
  snapshot: EngineSnapshot | null;
  baselineExtFrag?: number;
  /** Set by quest runner when a sandbox alloc of the target size succeeds. */
  flags?: Record<string, boolean>;
}

export interface QuestDef {
  id: string;
  title: string;
  difficulty: 'novice' | 'adept' | 'master';
  objective: string;
  hints: string[];
  explanation: string;
  isComplete: (ctx: QuestContext) => boolean;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'q1',
    title: 'Claim a Plot',
    difficulty: 'novice',
    objective: 'In the sandbox, successfully allocate 100 MB (arena.alloc).',
    hints: [
      'Open Memory Arena sandbox controls.',
      'Request size 100 and allocate.',
      'Confirm an allocated block of size 100 appears in the engine snapshot.'
    ],
    explanation: 'Allocation decisions come from the C engine via arena.alloc.',
    isComplete: ({ snapshot, flags }) =>
      Boolean(flags?.alloc100) ||
      Boolean(snapshot?.arena.blocks.some((b) => b.allocated && b.size === 100))
  },
  {
    id: 'q2',
    title: 'Merge to Make Room',
    difficulty: 'adept',
    objective: 'Free a neighbor so a merge creates a contiguous block large enough for a large request.',
    hints: [
      'Load the fragmented sandbox layout from the quest starter.',
      'Free the allocated neighbor between free holes.',
      'Allocate into the newly merged region.'
    ],
    explanation: 'Quest 2 is solved by freeing a neighbor so a merge creates a large enough block.',
    isComplete: ({ snapshot, flags }) =>
      Boolean(flags?.q2Solved) ||
      Boolean(
        snapshot &&
          snapshot.arena.statistics.largestFree >= 200 &&
          snapshot.arena.blocks.some((b) => b.allocated && b.size >= 200)
      )
  },
  {
    id: 'q3',
    title: 'Predict First Fit',
    difficulty: 'adept',
    objective: 'Select First Fit, predict the offset, then allocate and confirm the engine offset matches.',
    hints: ['First Fit takes the first free block that fits.', 'Bonus only if the predicted offset matches.'],
    explanation: 'Reasoning before allocating is rewarded; button spam scores nothing.',
    isComplete: ({ flags }) => Boolean(flags?.predictionCorrect)
  },
  {
    id: 'q4',
    title: 'Why Did It Fail?',
    difficulty: 'adept',
    objective: 'Trigger an allocation failure and read the engine reason.',
    hints: ['Fragmented free space can fail even when total free looks ample.'],
    explanation: 'Failure reasons are produced by the C engine, never guessed in the UI.',
    isComplete: ({ events, flags }) =>
      Boolean(flags?.allocFailed) || events.some((e) => e.kind === 'alloc_failed')
  },
  {
    id: 'q5',
    title: 'Follow the Compass',
    difficulty: 'master',
    objective: 'Select Next Fit and perform two sandbox allocations; observe nextFitOffset from snapshots.',
    hints: ['The Next Fit pointer is engine state — read it from the snapshot.'],
    explanation: 'Next Fit walks from the persistent pointer (ASM-8).',
    isComplete: ({ flags }) => Boolean(flags?.twoNextFitAllocs)
  },
  {
    id: 'q6',
    title: 'Calm the Dragon',
    difficulty: 'master',
    objective: 'Reduce external fragmentation by at least 10 percentage points via frees/merges.',
    hints: ['Merging adjacent free territories lowers dragonPower (engine externalFragmentation).'],
    explanation: 'Quest 6 passes when external fragmentation drops by a defined threshold.',
    isComplete: ({ snapshot, baselineExtFrag, flags }) => {
      if (flags?.fragDropped) return true;
      if (!snapshot || baselineExtFrag === undefined) return false;
      return baselineExtFrag - snapshot.arena.statistics.externalFragmentation >= 10;
    }
  }
];
