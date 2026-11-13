import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FragmentationDungeon } from '../pages/FragmentationDungeon';
import { useSimStore } from '../store/simStore';
import { EngineSnapshot } from '../types/engine';

const mockSnapshot: EngineSnapshot = {
  t: 10,
  seq: 1,
  runningPid: 1,
  isFinished: false,
  queues: {
    input: [],
    userJob: [],
    q1: [1],
    q2: [2],
    q3: []
  },
  arena: {
    total: 1024,
    nextFitOffset: 200,
    blocks: [
      { offset: 0, size: 200, allocated: true, pid: 1, requestedSize: 200 },
      { offset: 200, size: 300, allocated: false },
      { offset: 500, size: 200, allocated: true, pid: 2, requestedSize: 200 },
      { offset: 700, size: 324, allocated: false }
    ],
    statistics: {
      total: 1024,
      allocated: 400,
      free: 624,
      largestFree: 324,
      externalFragmentation: 48,
      internalFragmentation: 0,
      allocationEfficiency: 100.0,
      dragonPower: 48,
      dragonTier: 2,
      cracks: 1,
      freeBlockCount: 2,
      largestFreePctOfTotal: 31,
      failedAttempts: 1,
      processesDelayed: 0,
      searchSteps: 3,
      utilization: 39
    }
  },
  processes: [
    { pid: 1, name: 'P1', priority: 1, arrivalTime: 0, cpuTime: 10, remainingTime: 5, memMb: 200, state: 'RUNNING' },
    { pid: 2, name: 'P2', priority: 2, arrivalTime: 1, cpuTime: 8, remainingTime: 8, memMb: 200, state: 'READY' }
  ]
};

describe('Fragmentation Dungeon', () => {
  beforeEach(() => {
    useSimStore.setState({
      snapshots: [],
      cursor: -1,
      events: []
    });
  });

  it('displays empty state when no statistics exist', () => {
    render(<FragmentationDungeon />);
    expect(screen.getByText('No statistics yet.')).toBeInTheDocument();
  });

  it('renders separate internal and external fragmentation metrics from engine data', () => {
    useSimStore.setState({
      snapshots: [mockSnapshot],
      cursor: -1
    });

    render(<FragmentationDungeon />);

    // External fragmentation stat
    expect(screen.getAllByText('48%').length).toBeGreaterThan(0);
    expect(screen.getByTestId('dragon-power')).toHaveTextContent('48');
    expect(screen.getByTestId('dragon-tier')).toHaveTextContent('2 (Awake)');

    // Internal fragmentation stat (should be 0 MB with exact-size splitting)
    const internalFragStat = screen.getByTestId('internal-fragmentation');
    expect(internalFragStat).toBeInTheDocument();
    expect(internalFragStat).toHaveTextContent('0 MB');

    // Allocation efficiency
    const allocEffStat = screen.getByTestId('allocation-efficiency');
    expect(allocEffStat).toBeInTheDocument();
    expect(allocEffStat).toHaveTextContent('100.0%');

    // Comparative anatomy section
    expect(screen.getByTestId('fragmentation-comparison')).toBeInTheDocument();
    expect(screen.getByTestId('internal-frag-pill')).toHaveTextContent('0 MB');
    expect(screen.getByTestId('efficiency-stat')).toHaveTextContent('100.0%');
  });

  it('renders the dragon canvas with proper tier and power', () => {
    useSimStore.setState({
      snapshots: [mockSnapshot],
      cursor: -1
    });

    render(<FragmentationDungeon />);

    const dragonView = screen.getByTestId('dragon-dungeon-view');
    expect(dragonView).toBeInTheDocument();
    const canvas = dragonView.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas?.getAttribute('aria-label')).toContain('Tier 2 (Awake)');
    expect(canvas?.getAttribute('aria-label')).toContain('Power 48%');
  });

  it('renders free chambers with proper offsets and sizes', () => {
    useSimStore.setState({
      snapshots: [mockSnapshot],
      cursor: -1
    });

    render(<FragmentationDungeon />);

    const freeChambers = screen.getByTestId('free-chambers');
    expect(freeChambers).toBeInTheDocument();
    expect(freeChambers).toHaveTextContent('@200 · 300 MB');
    expect(freeChambers).toHaveTextContent('@700 · 324 MB');
  });
});
