import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/AppShell';
import { CustomWorkloadBuilder } from '../components/CustomWorkloadBuilder';
import { TimeControls } from '../components/TimeControls';
import { KingdomOverview } from '../pages/KingdomOverview';
import { ProcessTavern } from '../pages/ProcessTavern';
import { useSimStore } from '../store/simStore';

vi.mock('../services/api', () => ({
  createSession: vi.fn(async (cfg) => ({
    ok: true,
    data: {
      id: 'mock-custom-session',
      config: {
        policy: cfg?.policy || 'first_fit',
        quantum: 1,
        totalMemory: cfg?.totalMemory || 1024,
        demotionTrigger: 'always',
        admissionOrdering: 'fifo-block',
        engine: 'sim'
      }
    }
  })),
  deleteSession: vi.fn(async () => ({ ok: true })),
  sendCommand: vi.fn(async (_id, payload) => {
    if (payload.cmd === 'workload.load') {
      return { ok: true, data: { jobCount: payload.jobs?.length ?? 0 } };
    }
    return { ok: true, data: {} };
  }),
  getSnapshot: vi.fn(async () => ({
    ok: true,
    data: {
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
    }
  })),
  getEvents: vi.fn(async () => ({ ok: true, data: [] })),
  getEventsUrl: vi.fn((id: string) => `/api/sessions/${id}/events`),
  runCompare: vi.fn(async (_jobs, _mem) => ({
    ok: true,
    data: {
      results: [
        { policy: 'first_fit', utilization: 75, externalFragmentation: 10, totalSearchSteps: 5, makespan: 10, totalFree: 128 },
        { policy: 'next_fit', utilization: 70, externalFragmentation: 12, totalSearchSteps: 6, makespan: 10, totalFree: 128 },
        { policy: 'best_fit', utilization: 80, externalFragmentation: 8, totalSearchSteps: 4, makespan: 10, totalFree: 128 },
        { policy: 'worst_fit', utilization: 65, externalFragmentation: 15, totalSearchSteps: 7, makespan: 10, totalFree: 128 }
      ]
    }
  })),
  fetchCustomPolicySnapshot: vi.fn(async () => ({
    t: 10,
    seq: 15,
    runningPid: -1,
    isFinished: true,
    queues: { input: [], userJob: [], q1: [], q2: [], q3: [] },
    arena: {
      total: 512,
      nextFitOffset: 0,
      blocks: [],
      statistics: {
        total: 512,
        allocated: 384,
        free: 128,
        freeBlockCount: 1,
        largestFree: 128,
        smallestFree: 128,
        utilization: 75,
        externalFragmentation: 0,
        isExternalFragUndefined: false,
        largestFreePctOfTotal: 25,
        failedAttempts: 0,
        processesDelayed: 0,
        searchSteps: 5,
        dragonPower: 0,
        dragonTier: 0,
        cracks: 0
      }
    },
    processes: []
  })),
  fetchPolicySnapshotAt: vi.fn(async () => ({
    t: 6,
    seq: 10,
    runningPid: -1,
    isFinished: false,
    queues: { input: [], userJob: [], q1: [], q2: [], q3: [] },
    arena: { total: 1024, nextFitOffset: 960, blocks: [], statistics: {} },
    processes: []
  }))
}));

describe('Manual Custom Workload Builder & Integration', () => {
  beforeEach(() => {
    useSimStore.setState({
      sessionId: 'mock-session-id',
      isInitializing: false,
      isCustomWorkloadOpen: false,
      workloadSource: 'assignment',
      customJobs: null,
      activeWorkload: {
        source: 'assignment',
        totalMemory: 1024,
        quantum: 1
      },
      events: [],
      snapshots: [],
      cursor: -1,
      config: {
        policy: 'first_fit',
        quantum: 1,
        totalMemory: 1024,
        demotionTrigger: 'always',
        admissionOrdering: 'fifo-block',
        engine: 'sim'
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Create Dataset" button across TimeControls, KingdomOverview, and ProcessTavern', async () => {
    const user = userEvent.setup();

    // 1. TimeControls
    const { unmount: unmountTC } = render(<TimeControls />);
    const tcBtn = screen.getByTestId('ctrl-create-dataset');
    expect(tcBtn).toBeInTheDocument();
    await user.click(tcBtn);
    expect(useSimStore.getState().isCustomWorkloadOpen).toBe(true);
    useSimStore.getState().closeCustomWorkload();
    unmountTC();

    // 2. KingdomOverview
    const { unmount: unmountOverview } = render(<KingdomOverview />);
    const ovBtn = screen.getByTestId('overview-create-dataset');
    expect(ovBtn).toBeInTheDocument();
    await user.click(ovBtn);
    expect(useSimStore.getState().isCustomWorkloadOpen).toBe(true);
    useSimStore.getState().closeCustomWorkload();
    unmountOverview();

    // 3. ProcessTavern
    const { unmount: unmountTavern } = render(<ProcessTavern />);
    const tvBtn = screen.getByTestId('tavern-create-dataset');
    expect(tvBtn).toBeInTheDocument();
    await user.click(tvBtn);
    expect(useSimStore.getState().isCustomWorkloadOpen).toBe(true);
    unmountTavern();
  });

  it('Create Dataset opens a fresh builder with no previous process entries', () => {
    useSimStore.getState().openCustomWorkload();
    render(<CustomWorkloadBuilder />);

    const memInput = screen.getByTestId('input-total-memory') as HTMLInputElement;
    expect(memInput).toBeInTheDocument();
    expect(memInput.value).toBe('1024');

    const quantumInput = screen.getByTestId('input-cpu-quantum') as HTMLInputElement;
    expect(quantumInput).toBeInTheDocument();
    expect(quantumInput).toBeDisabled();
    expect(quantumInput.value).toContain('1 second');

    // Requirement: No previous process entries initially
    expect(screen.getByTestId('preview-count')).toHaveTextContent('0');
    expect(screen.getByTestId('empty-processes-notice')).toBeInTheDocument();
  });

  it('allows adding and removing processes and updates preview', async () => {
    const user = userEvent.setup();
    useSimStore.getState().openCustomWorkload();
    render(<CustomWorkloadBuilder />);

    expect(screen.getByTestId('preview-count')).toHaveTextContent('0');

    // Add first process
    const addBtn = screen.getByTestId('btn-add-process');
    await user.click(addBtn);
    expect(screen.getByTestId('preview-count')).toHaveTextContent('1');
    expect(screen.getByText('P0')).toBeInTheDocument();

    // Add second process
    await user.click(addBtn);
    expect(screen.getByTestId('preview-count')).toHaveTextContent('2');
    expect(screen.getByText('P1')).toBeInTheDocument();

    // Remove P1
    const removeBtn = screen.getByTestId('btn-remove-1');
    await user.click(removeBtn);
    expect(screen.getByTestId('preview-count')).toHaveTextContent('1');
  });

  it('validates that empty workload is rejected and process memory cannot exceed capacity', async () => {
    const user = userEvent.setup();
    useSimStore.getState().openCustomWorkload();
    render(<CustomWorkloadBuilder />);

    // Attempt start with empty processes
    const startBtn = screen.getByTestId('btn-start-simulation');
    await user.click(startBtn);
    expect(screen.getByTestId('custom-workload-error')).toHaveTextContent(/cannot be empty/i);

    // Reset to sample workload
    const sampleBtn = screen.getByTestId('btn-reset-sample');
    await user.click(sampleBtn);
    expect(screen.getByTestId('preview-count')).toHaveTextContent('4');

    // Set total memory to 512
    const memInput = screen.getByTestId('input-total-memory');
    await user.clear(memInput);
    await user.type(memInput, '512');

    // Set P0 memory request to 600
    const p0Mem = screen.getByTestId('input-mem-0');
    await user.clear(p0Mem);
    await user.type(p0Mem, '600');

    // Attempt start
    await user.click(startBtn);
    const errorBanner = screen.getByTestId('custom-workload-error');
    expect(errorBanner).toHaveTextContent(/exceeds configured total capacity/i);
  });

  it('submits valid custom workload to real C engine bridge and starts simulation', async () => {
    const user = userEvent.setup();
    useSimStore.getState().openCustomWorkload();
    render(<CustomWorkloadBuilder />);

    // Load sample workload
    await user.click(screen.getByTestId('btn-reset-sample'));

    // Change total memory to 512
    const memInput = screen.getByTestId('input-total-memory');
    await user.clear(memInput);
    await user.type(memInput, '512');

    // Ensure all processes fit within 512 MB
    const p1Mem = screen.getByTestId('input-mem-1');
    await user.clear(p1Mem);
    await user.type(p1Mem, '128');

    // Start simulation
    const startBtn = screen.getByTestId('btn-start-simulation');
    await user.click(startBtn);

    await waitFor(() => {
      expect(useSimStore.getState().isCustomWorkloadOpen).toBe(false);
      expect(useSimStore.getState().workloadSource).toBe('custom');
      expect(useSimStore.getState().customJobs).toHaveLength(4);
      expect(useSimStore.getState().config.totalMemory).toBe(512);
      expect(useSimStore.getState().location).toBe('arena');
    });
  });

  it('Restart preserves active custom workload configuration and starts fresh session at t=0 without reopening builder', async () => {
    // 1. Establish active custom workload
    const customJobs = [
      { name: 'P0', arrival: 0, cpuBurst: 3, memMb: 128, priority: 1 },
      { name: 'P1', arrival: 1, cpuBurst: 2, memMb: 256, priority: 2 }
    ];
    await useSimStore.getState().loadCustomWorkload(customJobs, 512);

    expect(useSimStore.getState().activeWorkload?.source).toBe('custom');
    expect(useSimStore.getState().activeWorkload?.totalMemory).toBe(512);
    expect(useSimStore.getState().activeWorkload?.jobs).toHaveLength(2);

    // Simulate tick advancing time and generating events
    useSimStore.setState({
      events: [{ type: 'event', seq: 1, t: 1, kind: 'process_arrived', data: {} }],
      cursor: 2
    });

    // 2. Click Restart
    await useSimStore.getState().restart();

    // 3. Verify:
    // - Active workload configuration is preserved
    expect(useSimStore.getState().activeWorkload?.source).toBe('custom');
    expect(useSimStore.getState().activeWorkload?.totalMemory).toBe(512);
    expect(useSimStore.getState().activeWorkload?.jobs).toHaveLength(2);
    expect(useSimStore.getState().config.totalMemory).toBe(512);

    // - Simulation state is reset to t=0
    expect(useSimStore.getState().events).toHaveLength(0);
    expect(useSimStore.getState().cursor).toBe(-1);

    // - Builder modal is NOT opened
    expect(useSimStore.getState().isCustomWorkloadOpen).toBe(false);
  });

  it('Reset clears active workload and session, shows empty-state message, and does not retain workload for Start', async () => {
    // 1. Establish active custom workload
    const customJobs = [
      { name: 'P0', arrival: 0, cpuBurst: 3, memMb: 128, priority: 1 },
      { name: 'P1', arrival: 1, cpuBurst: 2, memMb: 256, priority: 2 }
    ];
    await useSimStore.getState().loadCustomWorkload(customJobs, 512);

    // 2. Call Reset
    await useSimStore.getState().reset();

    // 3. Verify Reset state
    expect(useSimStore.getState().activeWorkload).toBeNull();
    expect(useSimStore.getState().sessionId).toBeNull();
    expect(useSimStore.getState().events).toHaveLength(0);
    expect(useSimStore.getState().snapshots).toHaveLength(0);
    expect(useSimStore.getState().customJobs).toBeNull();

    // Empty-state message in oracle
    expect(useSimStore.getState().oracleMessage).toBe(
      'No active dataset. Create a new dataset or load the assignment dataset to begin.'
    );

    // 4. Verify Start cannot run or retain the prior custom workload
    useSimStore.getState().start();
    expect(useSimStore.getState().playing).toBe(false);

    // 5. Verify AppShell displays the friendly empty-state card
    render(<AppShell><div>Inner Content</div></AppShell>);
    expect(screen.getByTestId('no-active-dataset-card')).toBeInTheDocument();
    expect(screen.getByTestId('no-active-dataset-message')).toHaveTextContent(
      'No active dataset. Create a new dataset or load the assignment dataset to begin.'
    );
  });

  it('Load Assignment Dataset replaces the custom workload and restores 1024 MB memory', async () => {
    // Start with custom workload
    const customJobs = [{ name: 'P0', arrival: 0, cpuBurst: 2, memMb: 256, priority: 1 }];
    await useSimStore.getState().loadCustomWorkload(customJobs, 512);
    expect(useSimStore.getState().config.totalMemory).toBe(512);
    expect(useSimStore.getState().activeWorkload?.source).toBe('custom');

    // Load assignment dataset
    await useSimStore.getState().loadAssignment();

    expect(useSimStore.getState().activeWorkload?.source).toBe('assignment');
    expect(useSimStore.getState().activeWorkload?.totalMemory).toBe(1024);
    expect(useSimStore.getState().config.totalMemory).toBe(1024);
    expect(useSimStore.getState().customJobs).toBeNull();
  });

  it('cancelling the Custom Workload Builder preserves the active workload and simulation', async () => {
    const user = userEvent.setup();
    const customJobs = [
      { name: 'P0', arrival: 0, cpuBurst: 2, memMb: 128, priority: 1 },
      { name: 'P1', arrival: 1, cpuBurst: 3, memMb: 256, priority: 2 }
    ];
    await useSimStore.getState().loadCustomWorkload(customJobs, 512);

    // Open builder
    useSimStore.getState().openCustomWorkload();
    render(<CustomWorkloadBuilder />);
    expect(screen.getByTestId('custom-workload-modal')).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByTestId('btn-cancel-workload');
    await user.click(cancelBtn);

    // Modal closed, but active workload and config preserved
    expect(useSimStore.getState().isCustomWorkloadOpen).toBe(false);
    expect(useSimStore.getState().activeWorkload?.source).toBe('custom');
    expect(useSimStore.getState().activeWorkload?.totalMemory).toBe(512);
    expect(useSimStore.getState().activeWorkload?.jobs).toHaveLength(2);
  });

  it('applies improved contrast styling for inputs, numbers, and focus rings', () => {
    useSimStore.getState().openCustomWorkload();
    render(<CustomWorkloadBuilder />);

    const memInput = screen.getByTestId('input-total-memory');
    // Readable bright text and golden focus ring
    expect(memInput.className).toContain('text-gold-3');
    expect(memInput.className).toContain('focus:ring-gold-2');
    expect(memInput.className).toContain('bg-[#2a1f3d]');

    const quantumInput = screen.getByTestId('input-cpu-quantum');
    // Readable disabled field
    expect(quantumInput.className).toContain('text-stone-3');
  });

  it('Royal Strategy Room uses the currently active custom workload and memory capacity after restart', async () => {
    const customJobs = [
      { name: 'P0', arrival: 0, cpuBurst: 2, memMb: 128, priority: 1 },
      { name: 'P1', arrival: 1, cpuBurst: 3, memMb: 256, priority: 2 }
    ];
    await useSimStore.getState().loadCustomWorkload(customJobs, 512);

    // Restart simulation
    await useSimStore.getState().restart();

    // Call runCompare
    const apiMock = await import('../services/api');
    await useSimStore.getState().runCompare();

    expect(apiMock.runCompare).toHaveBeenCalledWith(customJobs, 512);
    expect(useSimStore.getState().compareResults).toHaveLength(4);
    expect(useSimStore.getState().strategyViews).toHaveLength(4);
  });
});
