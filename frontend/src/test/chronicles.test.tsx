import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Chronicles } from '../pages/Chronicles';
import { useSimStore } from '../store/simStore';
import type { EngineEvent, EngineSnapshot } from '../types/engine';

describe('Simulation Chronicles Page', () => {
  beforeEach(() => {
    useSimStore.setState({
      events: [],
      snapshots: [],
      cursor: -1
    });
  });

  it('displays helpful empty state when no events exist (Requirement 5)', () => {
    render(<Chronicles />);
    expect(screen.getByTestId('chronicles-empty')).toBeInTheDocument();
    expect(screen.getByText(/No events recorded yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Load the assignment workload/i)).toBeInTheDocument();
  });

  it('displays chronological events with type, time, PID and memory/scheduling info (Requirement 2)', () => {
    const mockEvents: EngineEvent[] = [
      {
        type: 'event',
        seq: 1,
        t: 0,
        kind: 'process_arrived',
        data: { pid: 6, name: 'P6', arrival: 0, priority: 1, cpuBurst: 5, memMb: 128 }
      },
      {
        type: 'event',
        seq: 2,
        t: 0,
        kind: 'process_admitted',
        data: { pid: 6, name: 'P6', offset: 0, size: 128, policy: 'first_fit' }
      },
      {
        type: 'event',
        seq: 3,
        t: 1,
        kind: 'process_dispatched',
        data: { pid: 6, name: 'P6', queueLevel: 1, remaining: 4 }
      },
      {
        type: 'event',
        seq: 4,
        t: 2,
        kind: 'process_demoted',
        data: { pid: 6, name: 'P6', fromQueue: 1, toQueue: 2, reason: 'quantum expired' }
      },
      {
        type: 'event',
        seq: 5,
        t: 5,
        kind: 'process_terminated',
        data: { pid: 6, name: 'P6', finishTime: 5, turnaround: 5 }
      },
      {
        type: 'event',
        seq: 6,
        t: 5,
        kind: 'memory_released',
        data: { pid: 6, name: 'P6', offset: 0, size: 128, survivorOffset: 0, survivorSize: 1024 }
      },
      {
        type: 'event',
        seq: 7,
        t: 6,
        kind: 'alloc_failed',
        data: { pid: 7, name: 'P7', size: 500, reason: 'insufficient free block' }
      },
      {
        type: 'event',
        seq: 8,
        t: 7,
        kind: 'idle',
        data: {}
      },
      {
        type: 'event',
        seq: 9,
        t: 10,
        kind: 'sim_finished',
        data: { makespan: 10 }
      }
    ];

    useSimStore.setState({ events: mockEvents });
    render(<Chronicles />);

    // All events rendered
    for (const e of mockEvents) {
      expect(screen.getByTestId(`event-seq-${e.seq}`)).toBeInTheDocument();
    }

    // Process arrival info
    expect(screen.getAllByText('P6').length).toBeGreaterThan(0);
    expect(screen.getByText(/Req: 128 MB/)).toBeInTheDocument();

    // Admitted info
    expect(screen.getByText(/admitted into arena/)).toBeInTheDocument();
    expect(screen.getByText(/@ 0x0000 \(0\)/)).toBeInTheDocument();

    // Dispatched info
    expect(screen.getByText(/dispatched to Royal CPU/)).toBeInTheDocument();
    expect(screen.getByText('Q1')).toBeInTheDocument();

    // Demoted info
    expect(screen.getAllByText(/demoted/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/quantum expired/).length).toBeGreaterThan(0);

    // Terminated info
    expect(screen.getByText(/turnaround 5 ticks/)).toBeInTheDocument();

    // Released info
    expect(screen.getByText(/merged hole: 1024 MB/)).toBeInTheDocument();

    // Failed info
    expect(screen.getByText(/Allocation failed for/)).toBeInTheDocument();
    expect(screen.getAllByText(/insufficient free block/).length).toBeGreaterThan(0);

    // Idle info
    expect(screen.getByText(/CPU idle/)).toBeInTheDocument();

    // Finished info
    expect(screen.getAllByText(/Total makespan: 10 ticks/).length).toBeGreaterThan(0);
  });

  it('filters by event kind and restores full history when All is selected (Requirement 3)', () => {
    const mockEvents: EngineEvent[] = [
      {
        type: 'event',
        seq: 1,
        t: 0,
        kind: 'process_arrived',
        data: { pid: 1, name: 'P1' }
      },
      {
        type: 'event',
        seq: 2,
        t: 0,
        kind: 'process_admitted',
        data: { pid: 1, name: 'P1' }
      },
      {
        type: 'event',
        seq: 3,
        t: 1,
        kind: 'process_arrived',
        data: { pid: 2, name: 'P2' }
      }
    ];

    useSimStore.setState({ events: mockEvents });
    render(<Chronicles />);

    expect(screen.getAllByRole('button', { name: /\[/ })).toHaveLength(3);

    // Filter to process_admitted
    fireEvent.click(screen.getByTestId('chronicles-filter-process_admitted'));
    expect(screen.getByTestId('event-seq-2')).toBeInTheDocument();
    expect(screen.queryByTestId('event-seq-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('event-seq-3')).not.toBeInTheDocument();

    // Filter to process_arrived
    fireEvent.click(screen.getByTestId('chronicles-filter-process_arrived'));
    expect(screen.getByTestId('event-seq-1')).toBeInTheDocument();
    expect(screen.getByTestId('event-seq-3')).toBeInTheDocument();
    expect(screen.queryByTestId('event-seq-2')).not.toBeInTheDocument();

    // Filter to idle (0 matches)
    fireEvent.click(screen.getByTestId('chronicles-filter-idle'));
    expect(screen.getByTestId('chronicles-no-matches')).toBeInTheDocument();
    expect(screen.getByText(/No events matching filter/)).toBeInTheDocument();

    // Restore all
    fireEvent.click(screen.getByTestId('chronicles-filter-all'));
    expect(screen.getAllByRole('button', { name: /\[/ })).toHaveLength(3);
  });

  it('scrubs memory snapshot when an event is clicked', () => {
    const mockEvents: EngineEvent[] = [
      { type: 'event', seq: 5, t: 2, kind: 'process_dispatched', data: { pid: 1 } }
    ];
    const mockSnapshots: EngineSnapshot[] = [
      {
        t: 0,
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
      },
      {
        t: 2,
        seq: 5,
        runningPid: 1,
        isFinished: false,
        queues: { input: [], userJob: [], q1: [1], q2: [], q3: [] },
        arena: {
          total: 1024,
          nextFitOffset: 0,
          blocks: [],
          statistics: {
            total: 1024,
            allocated: 128,
            free: 896,
            freeBlockCount: 1,
            largestFree: 896,
            smallestFree: 896,
            utilization: 12.5,
            externalFragmentation: 0,
            isExternalFragUndefined: false,
            largestFreePctOfTotal: 87.5,
            failedAttempts: 0,
            processesDelayed: 0,
            searchSteps: 1,
            dragonPower: 0,
            dragonTier: 0,
            cracks: 0
          }
        },
        processes: []
      }
    ];

    useSimStore.setState({ events: mockEvents, snapshots: mockSnapshots, cursor: 0 });
    render(<Chronicles />);

    fireEvent.click(screen.getByTestId('event-seq-5'));
    expect(useSimStore.getState().cursor).toBe(1);
  });

  it('groups events by simulation tick in visual timeline (Requirement 1)', () => {
    const mockEvents: EngineEvent[] = [
      { type: 'event', seq: 1, t: 0, kind: 'process_arrived', data: { pid: 0 } },
      { type: 'event', seq: 2, t: 0, kind: 'process_admitted', data: { pid: 0 } },
      { type: 'event', seq: 3, t: 1, kind: 'process_dispatched', data: { pid: 0 } },
      { type: 'event', seq: 4, t: 2, kind: 'idle', data: {} }
    ];

    useSimStore.setState({ events: mockEvents });
    render(<Chronicles />);

    expect(screen.getByTestId('timeline-tick-0')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-tick-1')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-tick-2')).toBeInTheDocument();
    expect(screen.getByText('TICK 0')).toBeInTheDocument();
    expect(screen.getByText('TICK 1')).toBeInTheDocument();
    expect(screen.getByText('TICK 2')).toBeInTheDocument();
  });

  it('provides replay navigation with Play, Pause, Previous, Next controls (Requirement 5)', () => {
    const mockEvents: EngineEvent[] = [
      { type: 'event', seq: 1, t: 0, kind: 'process_arrived', data: { pid: 1, name: 'P1' } },
      { type: 'event', seq: 2, t: 0, kind: 'process_admitted', data: { pid: 1, name: 'P1' } },
      { type: 'event', seq: 3, t: 1, kind: 'process_dispatched', data: { pid: 1, name: 'P1' } }
    ];

    useSimStore.setState({ events: mockEvents });
    render(<Chronicles />);

    const prevBtn = screen.getByTestId('chronicles-prev');
    const nextBtn = screen.getByTestId('chronicles-next');
    const playBtn = screen.getByTestId('chronicles-play-pause');
    const progress = screen.getByTestId('chronicles-progress');

    expect(progress).toHaveTextContent(/Event 1 of 3/);
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Advance to next event
    fireEvent.click(nextBtn);
    expect(progress).toHaveTextContent(/Event 2 of 3/);
    expect(prevBtn).toBeEnabled();

    // Advance to final event
    fireEvent.click(nextBtn);
    expect(progress).toHaveTextContent(/Event 3 of 3/);
    expect(nextBtn).toBeDisabled();

    // Go back with previous
    fireEvent.click(prevBtn);
    expect(progress).toHaveTextContent(/Event 2 of 3/);

    // Play button toggles play/pause state
    fireEvent.click(playBtn);
    expect(screen.getByText(/⏸ Pause/)).toBeInTheDocument();
    fireEvent.click(playBtn);
    expect(screen.getByText(/▶ Play/)).toBeInTheDocument();
  });

  it('renders synchronized memory layout and MLFQ queue indicators (Requirement 7)', () => {
    const mockEvents: EngineEvent[] = [
      { type: 'event', seq: 1, t: 0, kind: 'process_arrived', data: { pid: 1, name: 'P1' } }
    ];
    const mockSnapshots: EngineSnapshot[] = [
      {
        t: 0,
        seq: 1,
        runningPid: 1,
        isFinished: false,
        queues: { input: [2], userJob: [], q1: [1], q2: [3], q3: [4] },
        arena: {
          total: 1024,
          nextFitOffset: 0,
          blocks: [
            { offset: 0, size: 256, allocated: true, pid: 1 },
            { offset: 256, size: 768, allocated: false, pid: -1 }
          ],
          statistics: {
            total: 1024,
            allocated: 256,
            free: 768,
            freeBlockCount: 1,
            largestFree: 768,
            smallestFree: 768,
            utilization: 25,
            externalFragmentation: 0,
            isExternalFragUndefined: false,
            largestFreePctOfTotal: 75,
            failedAttempts: 0,
            processesDelayed: 0,
            searchSteps: 0,
            dragonPower: 0,
            dragonTier: 0,
            cracks: 0
          }
        },
        processes: []
      }
    ];

    useSimStore.setState({ events: mockEvents, snapshots: mockSnapshots, cursor: 0 });
    render(<Chronicles />);

    expect(screen.getByText(/Memory Arena \(1024 MB\)/)).toBeInTheDocument();
    expect(screen.getByText(/Allocated:/)).toBeInTheDocument();
    expect(screen.getByText(/256 MB/)).toBeInTheDocument();
    expect(screen.getAllByText(/768 MB/).length).toBeGreaterThan(0);
    expect(screen.getByText('Q1 (High)')).toBeInTheDocument();
    expect(screen.getByText('Q2 (Mid)')).toBeInTheDocument();
    expect(screen.getByText('Q3 (Low)')).toBeInTheDocument();
  });

  it('renders compact animated scene and collapsible technical details (Requirements 4 & 9)', () => {
    const mockEvents: EngineEvent[] = [
      { type: 'event', seq: 1, t: 0, kind: 'process_arrived', data: { pid: 1, name: 'P1', memMb: 128 } }
    ];

    useSimStore.setState({ events: mockEvents });
    render(<Chronicles />);

    // Animated scene present
    expect(screen.getByTestId('chronicles-scene')).toBeInTheDocument();
    expect(screen.getByText(/P1 Arrived at Kingdom Gates/)).toBeInTheDocument();

    // Collapsible technical details present
    expect(screen.getByTestId('technical-details')).toBeInTheDocument();
    expect(screen.getByTestId('event-log')).toBeInTheDocument();
  });

  it('visual filters control the timeline, replay controls, counts and scene (Additional Requirements)', () => {
    const mockEvents: EngineEvent[] = [
      { type: 'event', seq: 10, t: 0, kind: 'process_arrived', data: { pid: 1, name: 'P1' } },
      { type: 'event', seq: 11, t: 0, kind: 'process_admitted', data: { pid: 1, name: 'P1' } },
      { type: 'event', seq: 12, t: 1, kind: 'process_arrived', data: { pid: 2, name: 'P2' } },
      { type: 'event', seq: 13, t: 1, kind: 'process_admitted', data: { pid: 2, name: 'P2' } },
      { type: 'event', seq: 14, t: 2, kind: 'process_dispatched', data: { pid: 1, name: 'P1' } }
    ];

    useSimStore.setState({ events: mockEvents });
    render(<Chronicles />);

    const nextBtn = screen.getByTestId('chronicles-next');
    const progress = screen.getByTestId('chronicles-progress');

    // Initially "all" shows 5 events
    expect(progress).toHaveTextContent(/Event 1 of 5/);

    // Select filter: process_admitted (2 events: seq 11 and seq 13)
    fireEvent.click(screen.getByTestId('chronicles-filter-process_admitted'));
    expect(progress).toHaveTextContent(/Event 1 of 2/);
    expect(screen.getByText(/P1 Admitted into Memory Territory/)).toBeInTheDocument();

    // Replay Next navigates ONLY to the second admitted event (seq 13)
    fireEvent.click(nextBtn);
    expect(progress).toHaveTextContent(/Event 2 of 2/);
    expect(screen.getByText(/P2 Admitted into Memory Territory/)).toBeInTheDocument();

    // Switch filter to process_dispatched: resets playback to first matching event (seq 14)
    fireEvent.click(screen.getByTestId('chronicles-filter-process_dispatched'));
    expect(progress).toHaveTextContent(/Event 1 of 1/);
    expect(screen.getByText(/P1 Dispatched to Royal CPU Core/)).toBeInTheDocument();

    // Switch filter to an empty kind (alloc_failed): shows empty-state, hides timeline cards
    fireEvent.click(screen.getByTestId('chronicles-filter-alloc_failed'));
    expect(screen.getByTestId('chronicles-no-matches')).toBeInTheDocument();
    expect(screen.queryByTestId('chronicles-scene')).not.toBeInTheDocument();
  });
});
