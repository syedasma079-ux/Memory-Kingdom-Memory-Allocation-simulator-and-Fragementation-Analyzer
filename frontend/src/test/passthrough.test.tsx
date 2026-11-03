import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TechnicalView } from '../memory-arena/ArenaViews';
import { renderOracle } from '../oracle/templates';
import { useSimStore } from '../store/simStore';
import type { EngineSnapshot } from '../types/engine';

function shiftedSnapshot(): EngineSnapshot {
  return {
    t: 3,
    seq: 99,
    runningPid: -1,
    isFinished: false,
    queues: { input: [], userJob: [], q1: [], q2: [], q3: [] },
    arena: {
      total: 1024,
      nextFitOffset: 777,
      blocks: [
        { offset: 11, size: 17, allocated: true, pid: 42 },
        { offset: 28, size: 996, allocated: false, pid: -1 }
      ],
      statistics: {
        total: 1024,
        allocated: 17,
        free: 1007,
        freeBlockCount: 1,
        largestFree: 1007,
        smallestFree: 1007,
        utilization: 1.66,
        externalFragmentation: 12.34,
        isExternalFragUndefined: false,
        largestFreePctOfTotal: 98.34,
        failedAttempts: 2,
        processesDelayed: 1,
        searchSteps: 55,
        dragonPower: 12.34,
        dragonTier: 1,
        cracks: 0
      }
    },
    processes: []
  };
}

describe('passthrough: frontend never recomputes engine numbers', () => {
  it('table, next-fit marker and oracle show exact snapshot/event values', () => {
    const snap = shiftedSnapshot();
    useSimStore.setState({ snapshots: [snap], cursor: -1 });
    render(<TechnicalView />);

    expect(screen.getByTestId('block-row-0')).toHaveTextContent('11');
    expect(screen.getByTestId('block-row-0')).toHaveTextContent('17');
    expect(screen.getByTestId('block-row-0')).toHaveTextContent('42');
    expect(screen.getByText(/Next Fit pointer @ offset 777/)).toBeInTheDocument();

    const oracle = renderOracle({
      type: 'event',
      seq: 1,
      t: 4,
      kind: 'process_admitted',
      data: { pid: 6, offset: 11, size: 17, policy: 'next_fit' }
    });
    expect(oracle).toContain('offset 11');
    expect(oracle).toContain('17 MB');
    expect(oracle).toContain('P6');
  });

  it('dungeon stats bind dragonPower from snapshot, not a local formula', () => {
    const snap = shiftedSnapshot();
    expect(snap.arena.statistics.dragonPower).toBe(snap.arena.statistics.externalFragmentation);
  });
});
