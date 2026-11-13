import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { StrategyRoom } from '../pages/StrategyRoom';
import { useSimStore } from '../store/simStore';
import type { PolicyMidRunView } from '../types/engine';

const dummySteps = [
  {
    step: 0,
    processName: 'Initial (t=6)',
    requestSize: 0,
    allocatedOffset: null,
    allocatedSize: null,
    freeBlocksBefore: [{ offset: 0, size: 192 }, { offset: 224, size: 416 }, { offset: 672, size: 160 }, { offset: 960, size: 64 }],
    blocksExamined: [
      { offset: 0, size: 192, verdict: 'skipped' as const },
      { offset: 224, size: 416, verdict: 'skipped' as const },
      { offset: 672, size: 160, verdict: 'skipped' as const },
      { offset: 960, size: 64, verdict: 'skipped' as const }
    ],
    reason: 'G1 baseline layout at t=6: P1(32MB), P3(32MB), P5(128MB) allocated.',
    nextFitOffset: 960,
    statistics: {
      total: 1024,
      allocated: 192,
      free: 832,
      freeBlockCount: 4,
      largestFree: 416,
      smallestFree: 64,
      utilization: 18.75,
      externalFragmentation: 0,
      isExternalFragUndefined: false,
      largestFreePctOfTotal: 40.6,
      failedAttempts: 0,
      processesDelayed: 0,
      searchSteps: 21,
      dragonPower: 0,
      dragonTier: 0,
      cracks: 0
    },
    blocks: [
      { offset: 0, size: 192, allocated: false, pid: -1 },
      { offset: 192, size: 32, allocated: true, pid: 1 },
      { offset: 224, size: 416, allocated: false, pid: -1 },
      { offset: 640, size: 32, allocated: true, pid: 3 },
      { offset: 672, size: 160, allocated: false, pid: -1 },
      { offset: 832, size: 128, allocated: true, pid: 5 },
      { offset: 960, size: 64, allocated: false, pid: -1 }
    ]
  },
  {
    step: 1,
    processName: 'P6',
    requestSize: 108,
    allocatedOffset: 0,
    allocatedSize: 108,
    freeBlocksBefore: [{ offset: 0, size: 192 }, { offset: 224, size: 416 }, { offset: 672, size: 160 }, { offset: 960, size: 64 }],
    blocksExamined: [
      { offset: 0, size: 192, verdict: 'accepted' as const },
      { offset: 224, size: 416, verdict: 'skipped' as const },
      { offset: 672, size: 160, verdict: 'skipped' as const },
      { offset: 960, size: 64, verdict: 'skipped' as const }
    ],
    reason: 'Scanned from 0; first adequate block is [0..192] (192 MB >= 108 MB).',
    nextFitOffset: 960,
    statistics: {
      total: 1024,
      allocated: 300,
      free: 724,
      freeBlockCount: 4,
      largestFree: 416,
      smallestFree: 64,
      utilization: 29.3,
      externalFragmentation: 42.5,
      isExternalFragUndefined: false,
      largestFreePctOfTotal: 40.6,
      failedAttempts: 0,
      processesDelayed: 0,
      searchSteps: 22,
      dragonPower: 42.5,
      dragonTier: 1,
      cracks: 1
    },
    blocks: [
      { offset: 0, size: 108, allocated: true, pid: 6 },
      { offset: 108, size: 84, allocated: false, pid: -1 },
      { offset: 192, size: 32, allocated: true, pid: 1 },
      { offset: 224, size: 416, allocated: false, pid: -1 },
      { offset: 640, size: 32, allocated: true, pid: 3 },
      { offset: 672, size: 160, allocated: false, pid: -1 },
      { offset: 832, size: 128, allocated: true, pid: 5 },
      { offset: 960, size: 64, allocated: false, pid: -1 }
    ]
  }
];

const mockViews: PolicyMidRunView[] = [
  {
    policy: 'first_fit',
    t: 7,
    nextFitOffset: 188,
    offsets: { P6: 0, P7: 224, P8: 108 },
    blocks: dummySteps[1].blocks,
    statistics: dummySteps[1].statistics,
    steps: dummySteps
  },
  {
    policy: 'next_fit',
    t: 7,
    nextFitOffset: 560,
    offsets: { P6: 0, P7: 224, P8: 480 },
    blocks: dummySteps[1].blocks,
    statistics: dummySteps[1].statistics,
    steps: dummySteps
  },
  {
    policy: 'best_fit',
    t: 7,
    nextFitOffset: 560,
    offsets: { P6: 672, P7: 224, P8: 480 },
    blocks: dummySteps[1].blocks,
    statistics: dummySteps[1].statistics,
    steps: dummySteps
  },
  {
    policy: 'worst_fit',
    t: 7,
    nextFitOffset: 80,
    offsets: { P6: 224, P7: 332, P8: 0 },
    blocks: dummySteps[1].blocks,
    statistics: dummySteps[1].statistics,
    steps: dummySteps
  }
];

describe('StrategyRoom visual 4-algorithm comparison', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSimStore.setState({
      strategyViews: mockViews,
      compareResults: [
        {
          policy: 'first_fit',
          successfulAttempts: 9,
          failedAttempts: 0,
          processesDelayed: 0,
          totalFree: 388,
          largestFree: 160,
          freeBlockCount: 4,
          utilization: 62.11,
          externalFragmentation: 58.76,
          totalSearchSteps: 28,
          avgMemoryWait: 0,
          avgTurnaround: 4.22,
          makespan: 14
        }
      ]
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all four algorithms side by side with real layouts and step controls', () => {
    render(<StrategyRoom />);

    // Check all 4 policies are rendered side by side
    expect(screen.getByTestId('strategy-policy-first_fit')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-policy-next_fit')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-policy-best_fit')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-policy-worst_fit')).toBeInTheDocument();

    // Check proportional layout bars exist for each algorithm
    expect(screen.getByTestId('strategy-layout-first_fit')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-layout-next_fit')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-layout-best_fit')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-layout-worst_fit')).toBeInTheDocument();

    // Check step controls
    expect(screen.getByTestId('strategy-step-controls')).toBeInTheDocument();
    expect(screen.getByTestId('strategy-play-pause')).toHaveTextContent('▶ Play');

    // Check step pills
    const pill1 = screen.getByTestId('strategy-step-pill-1');
    expect(pill1).toHaveTextContent('Admit P6');
    fireEvent.click(pill1);

    // After clicking step 1, check trace info is updated
    expect(screen.getAllByText(/Offset @ 0/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Scanned from 0; first adequate block is/i).length).toBeGreaterThan(0);

    // Test Play / Pause toggle
    const playBtn = screen.getByTestId('strategy-play-pause');
    fireEvent.click(playBtn);
    expect(playBtn).toHaveTextContent('⏸ Pause');

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    fireEvent.click(playBtn);
    expect(playBtn).toHaveTextContent('▶ Play');

    // Test Reset
    const resetBtn = screen.getByTestId('strategy-reset-step');
    fireEvent.click(resetBtn);

    // Verify statistics and golden offsets are displayed
    expect(screen.getByTestId('g3-stats-first_fit')).toHaveTextContent('Search steps:');
    expect(screen.getByTestId('g3-stats-first_fit')).toHaveTextContent('Ext frag:');
    expect(screen.getByTestId('g2-offsets-first_fit')).toHaveTextContent('P6 @ 0');
  });
});
