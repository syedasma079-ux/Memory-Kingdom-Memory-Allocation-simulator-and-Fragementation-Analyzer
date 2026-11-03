/**
 * Scripted quest solutions — command sequences a test replays against the API/engine.
 * Predicates consume only engine replies/snapshots, never client-side allocation math.
 */

export interface ScriptStep {
  cmd: string;
  [key: string]: unknown;
}

/** Fragmented layout: free 64 | alloc 64 | free 64 | alloc 64 | free 768  (total 1024)
 *  Freeing the first allocated neighbor merges free 64+64+64 = 192... actually:
 *  offsets: 0/100 F, 100/50 T, 150/100 F, 250/50 T, 300/724 F
 *  Freeing offset 100 merges 0..250 into 250 free, then can alloc 200.
 */
export const Q2_LOAD_LAYOUT: ScriptStep = {
  cmd: 'arena.loadLayout',
  blocks: [
    { size: 100, allocated: 0 },
    { size: 50, allocated: 1 },
    { size: 100, allocated: 0 },
    { size: 50, allocated: 1 },
    { size: 724, allocated: 0 }
  ]
};

export const Q2_SOLUTION: ScriptStep[] = [
  Q2_LOAD_LAYOUT,
  { cmd: 'arena.free', offset: 100 },
  { cmd: 'arena.alloc', size: 200, pid: 42 }
];

/** Layout with high external fragmentation for Q6. */
export const Q6_LOAD_LAYOUT: ScriptStep = {
  cmd: 'arena.loadLayout',
  blocks: [
    { size: 64, allocated: 0 },
    { size: 64, allocated: 1 },
    { size: 64, allocated: 0 },
    { size: 64, allocated: 1 },
    { size: 64, allocated: 0 },
    { size: 64, allocated: 1 },
    { size: 64, allocated: 0 },
    { size: 576, allocated: 1 }
  ]
};

export const Q6_SOLUTION: ScriptStep[] = [
  Q6_LOAD_LAYOUT,
  { cmd: 'arena.free', offset: 64 },
  { cmd: 'arena.free', offset: 192 },
  { cmd: 'arena.free', offset: 320 }
];

export const Q1_SOLUTION: ScriptStep[] = [{ cmd: 'arena.alloc', size: 100, pid: 1 }];

export const Q4_SOLUTION: ScriptStep[] = [
  {
    cmd: 'arena.loadLayout',
    blocks: [
      { size: 100, allocated: 0 },
      { size: 50, allocated: 1 },
      { size: 100, allocated: 0 },
      { size: 774, allocated: 1 }
    ]
  },
  { cmd: 'arena.alloc', size: 150, pid: 9 }
];

export const Q5_SOLUTION: ScriptStep[] = [
  { cmd: 'session.configure', policy: 'next_fit' },
  { cmd: 'arena.alloc', size: 64, pid: 1 },
  { cmd: 'arena.alloc', size: 64, pid: 2 }
];
