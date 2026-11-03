import { describe, expect, it } from 'vitest';
import { QUESTS } from './definitions';
import { Q1_SOLUTION, Q2_SOLUTION, Q4_SOLUTION, Q5_SOLUTION, Q6_SOLUTION } from './solutions';
import type { EngineSnapshot } from '../types/engine';

function emptySnap(partial: Partial<EngineSnapshot['arena']> = {}): EngineSnapshot {
  return {
    t: 0,
    seq: 0,
    runningPid: -1,
    isFinished: false,
    queues: { input: [], userJob: [], q1: [], q2: [], q3: [] },
    arena: {
      total: 1024,
      nextFitOffset: 0,
      blocks: [{ offset: 0, size: 1024, allocated: false, pid: -1 }],
      statistics: {
        total: 1024,
        allocated: 0,
        free: 1024,
        freeBlockCount: 1,
        largestFree: 1024,
        smallestFree: 1024,
        utilization: 0,
        externalFragmentation: 40,
        isExternalFragUndefined: false,
        largestFreePctOfTotal: 100,
        failedAttempts: 0,
        processesDelayed: 0,
        searchSteps: 0,
        dragonPower: 40,
        dragonTier: 2,
        cracks: 3
      },
      ...partial
    },
    processes: []
  };
}

describe('quest scripted solutions', () => {
  it('ships a command sequence for each quest', () => {
    expect(Q1_SOLUTION[0].cmd).toBe('arena.alloc');
    expect(Q2_SOLUTION.some((s) => s.cmd === 'arena.free')).toBe(true);
    expect(Q2_SOLUTION.some((s) => s.cmd === 'arena.alloc' && s.size === 200)).toBe(true);
    expect(Q4_SOLUTION.some((s) => s.cmd === 'arena.alloc')).toBe(true);
    expect(Q5_SOLUTION[0]).toMatchObject({ cmd: 'session.configure', policy: 'next_fit' });
    expect(Q6_SOLUTION.filter((s) => s.cmd === 'arena.free').length).toBeGreaterThanOrEqual(2);
  });

  it('Q1 completes when engine snapshot contains a 100 MB allocated block', () => {
    const q1 = QUESTS.find((q) => q.id === 'q1')!;
    const snap = emptySnap({
      blocks: [
        { offset: 0, size: 100, allocated: true, pid: 1 },
        { offset: 100, size: 924, allocated: false, pid: -1 }
      ]
    });
    expect(q1.isComplete({ events: [], snapshot: snap })).toBe(true);
  });

  it('Q2 completes after merge creates a large allocated region (engine snapshot)', () => {
    const q2 = QUESTS.find((q) => q.id === 'q2')!;
    const snap = emptySnap({
      blocks: [
        { offset: 0, size: 200, allocated: true, pid: 42 },
        { offset: 200, size: 824, allocated: false, pid: -1 }
      ],
      statistics: {
        ...emptySnap().arena.statistics,
        largestFree: 824
      }
    });
    expect(q2.isComplete({ events: [], snapshot: snap })).toBe(true);
  });

  it('Q6 completes when engine externalFragmentation drops by >= 10', () => {
    const q6 = QUESTS.find((q) => q.id === 'q6')!;
    const snap = emptySnap({
      statistics: { ...emptySnap().arena.statistics, externalFragmentation: 20 }
    });
    expect(q6.isComplete({ events: [], snapshot: snap, baselineExtFrag: 40 })).toBe(true);
    expect(q6.isComplete({ events: [], snapshot: snap, baselineExtFrag: 25 })).toBe(false);
  });
});
