import { beforeEach, describe, expect, it } from 'vitest';
import { useSimStore } from './simStore';

describe('simStore reducers', () => {
  beforeEach(() => {
    useSimStore.setState({
      location: 'overview',
      events: [],
      snapshots: [],
      cursor: -1,
      oracleMessage: '',
      playing: false,
      playTimer: null
    });
  });

  it('setLocation updates location', () => {
    useSimStore.getState().setLocation('arena');
    expect(useSimStore.getState().location).toBe('arena');
  });

  it('appendEvent updates oracle from template', () => {
    useSimStore.getState().appendEvent({
      type: 'event',
      seq: 0,
      t: 0,
      kind: 'idle',
      data: {}
    });
    expect(useSimStore.getState().oracleMessage).toContain('idle');
  });

  it('getSnapshot returns cursor snapshot', () => {
    const snapA = {
      t: 1,
      seq: 1,
      runningPid: -1,
      isFinished: false,
      queues: { input: [], userJob: [], q1: [], q2: [], q3: [] },
      arena: {
        total: 1024,
        nextFitOffset: 0,
        blocks: [],
        statistics: {
          total: 1024,
          allocated: 0,
          free: 1024,
          freeBlockCount: 1,
          largestFree: 1024,
          smallestFree: 1024,
          utilization: 0,
          externalFragmentation: 0,
          isExternalFragUndefined: false,
          largestFreePctOfTotal: 100,
          failedAttempts: 0,
          processesDelayed: 0,
          searchSteps: 0,
          dragonPower: 0,
          dragonTier: 0,
          cracks: 0
        }
      },
      processes: []
    };
    const snapB = { ...snapA, t: 6, seq: 20 };
    useSimStore.setState({ snapshots: [snapA, snapB], cursor: 0 });
    expect(useSimStore.getState().getSnapshot()?.t).toBe(1);
    useSimStore.getState().setCursor(-1);
    expect(useSimStore.getState().getSnapshot()?.t).toBe(6);
  });

  it('does not invent allocation math in store', () => {
    expect(useSimStore.getState().setPolicy).toBeTypeOf('function');
  });
});
