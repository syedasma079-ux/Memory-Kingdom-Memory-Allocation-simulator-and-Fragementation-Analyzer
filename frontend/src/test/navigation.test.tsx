import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { LOCATIONS, useSimStore } from '../store/simStore';

vi.mock('../services/api', () => ({
  createSession: vi.fn(async () => ({
    ok: true,
    data: {
      id: 'test-session',
      config: {
        policy: 'first_fit',
        quantum: 1,
        totalMemory: 1024,
        demotionTrigger: 'always',
        admissionOrdering: 'fifo-block',
        engine: 'sim'
      }
    }
  })),
  deleteSession: vi.fn(async () => ({ ok: true })),
  sendCommand: vi.fn(async () => ({ ok: true, data: { offset: 0, size: 100 } })),
  getSnapshot: vi.fn(async () => ({
    ok: true,
    data: {
      t: 0,
      seq: 0,
      runningPid: -1,
      isFinished: false,
      queues: { input: [6], userJob: [], q1: [1], q2: [], q3: [] },
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
      processes: [
        {
          pid: 0,
          name: 'P0',
          arrival: 0,
          priority: 1,
          cpuBurst: 1,
          remaining: 1,
          memMb: 192,
          offset: -1,
          state: 'NOT_ARRIVED',
          queueLevel: 0,
          admittedTime: -1,
          finishTime: -1,
          waitedForMemory: 0
        }
      ]
    }
  })),
  getReport: vi.fn(async () => '{}'),
  runCompare: vi.fn(async () => ({ ok: true, data: { results: [] } })),
  fetchPolicySnapshotAt: vi.fn(async () => ({
    t: 6,
    arena: {
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
      },
      nextFitOffset: 0
    },
    processes: []
  })),
  getHealth: vi.fn(),
  getAssignmentDataset: vi.fn(),
  openEventStream: vi.fn()
}));

class FakeEventSource {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  close() { }
}
vi.stubGlobal('EventSource', FakeEventSource);
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:test';
}
URL.revokeObjectURL = () => undefined;

describe('navigation — all 10 locations', () => {
  beforeEach(() => {
    useSimStore.setState({
      location: 'overview',
      sessionId: 'test-session',
      events: [],
      snapshots: [],
      error: null,
      playing: false,
      playTimer: null
    });
  });

  afterEach(() => {
    useSimStore.getState().pause();
  });

  it('visits every location via sidebar and exercises primary controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const loc of LOCATIONS) {
      await user.click(screen.getByTestId(`nav-${loc.id}`));
      expect(screen.getByTestId(`page-${loc.id}`)).toBeInTheDocument();
    }

    await user.click(screen.getByTestId('nav-overview'));
    await user.click(screen.getByTestId('overview-load-assignment'));

    await user.click(screen.getByTestId('nav-arena'));
    await user.click(screen.getByTestId('arena-mode-technical'));
    await user.click(screen.getByTestId('arena-mode-world'));
    await user.click(screen.getByTestId('sandbox-alloc'));

    await user.click(screen.getByTestId('nav-guild'));
    await user.click(screen.getByTestId('guild-select-next_fit'));

    await user.click(screen.getByTestId('nav-tavern'));
    await user.click(screen.getByTestId('tavern-load-assignment'));
    await user.click(screen.getByTestId('tavern-random'));

    await user.click(screen.getByTestId('nav-castle'));
    await user.click(screen.getByTestId('castle-mode-sim'));

    await user.click(screen.getByTestId('nav-dungeon'));
    expect(screen.getByTestId('why-failed')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-strategy'));
    await user.click(screen.getByTestId('strategy-run-compare'));

    await user.click(screen.getByTestId('nav-quests'));
    await user.click(screen.getByTestId('quest-start-q1'));
    await user.click(screen.getByTestId('quest-hint'));

    await user.click(screen.getByTestId('nav-chronicles'));
    await user.click(screen.getByTestId('chronicles-filter-process_arrived'));

    await user.click(screen.getByTestId('nav-settings'));
    await user.click(screen.getByTestId('settings-reduced-motion'));

    await user.click(screen.getByTestId('ctrl-start'));
    await user.click(screen.getByTestId('ctrl-pause'));
    await user.click(screen.getByTestId('ctrl-tick'));
    await user.click(screen.getByTestId('ctrl-speed-2'));
    await user.click(screen.getByTestId('ctrl-reset'));
  });
});
