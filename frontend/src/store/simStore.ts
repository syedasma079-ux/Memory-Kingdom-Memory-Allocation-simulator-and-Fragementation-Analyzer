import { create } from 'zustand';
import { ASSUMPTIONS } from '../data/assumptions';
import { renderOracle } from '../oracle/templates';
import * as api from '../services/api';
import type {
  ActiveWorkloadConfig,
  AssumptionRow,
  ComparePolicyResult,
  EngineEvent,
  EngineSnapshot,
  Job,
  LocationId,
  Policy,
  PolicyMidRunView,
  SessionConfig
} from '../types/engine';

export const LOCATIONS: { id: LocationId; label: string }[] = [
  { id: 'overview', label: 'Kingdom Overview' },
  { id: 'arena', label: 'Memory Arena' },
  { id: 'guild', label: 'Algorithm Guild' },
  { id: 'tavern', label: 'Process Tavern' },
  { id: 'castle', label: 'Feedback Queue Castle' },
  { id: 'dungeon', label: 'Fragmentation Dungeon' },
  { id: 'strategy', label: 'Royal Strategy Room' },
  { id: 'quests', label: 'Quest and Challenge Board' },
  { id: 'chronicles', label: 'Simulation Chronicles' },
  { id: 'settings', label: 'System Settings' },
  { id: 'sprites', label: 'Sprite Atlas (Dev)' }
];

const defaultConfig: SessionConfig = {
  policy: 'first_fit',
  quantum: 1,
  totalMemory: 1024,
  demotionTrigger: 'always',
  admissionOrdering: 'fifo-block',
  engine: 'sim'
};

const defaultWorkload: ActiveWorkloadConfig = {
  source: 'assignment',
  totalMemory: 1024,
  quantum: 1
};

interface SimState {
  location: LocationId;
  sessionId: string | null;
  isInitializing: boolean;
  config: SessionConfig;
  events: EngineEvent[];
  snapshots: EngineSnapshot[];
  cursor: number; // index into snapshots; -1 = live head
  playing: boolean;
  speed: 1 | 2 | 4;
  reducedMotion: boolean;
  viewMode: 'world' | 'technical';
  highContrast: boolean;
  selectedBlockIndex: number | null;
  oracleMessage: string;
  compareResults: ComparePolicyResult[] | null;
  strategyViews: PolicyMidRunView[] | null;
  error: string | null;
  assumptions: AssumptionRow[];
  eventSource: EventSource | null;
  playTimer: ReturnType<typeof setInterval> | null;
  workloadSource: 'assignment' | 'custom' | 'random';
  customJobs: Job[] | null;
  activeWorkload: ActiveWorkloadConfig | null;
  isCustomWorkloadOpen: boolean;

  setLocation: (id: LocationId) => void;
  setViewMode: (mode: 'world' | 'technical') => void;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setSpeed: (s: 1 | 2 | 4) => void;
  setSelectedBlock: (i: number | null) => void;
  setCursor: (index: number) => void;
  openCustomWorkload: () => void;
  closeCustomWorkload: () => void;
  ensureSession: () => Promise<string | null>;
  createSession: (partial?: Partial<SessionConfig>) => Promise<void>;
  destroySession: () => Promise<void>;
  sendCommand: (payload: Record<string, unknown>) => Promise<unknown>;
  loadAssignment: () => Promise<void>;
  loadRandom: (seed?: number, n?: number) => Promise<void>;
  loadCustomWorkload: (jobs: Job[], totalMemory?: number) => Promise<void>;
  tick: () => Promise<void>;
  runUntil: (untilT: number) => Promise<void>;
  reset: () => Promise<void>;
  restart: () => Promise<void>;
  refreshSnapshot: () => Promise<EngineSnapshot | null>;
  start: () => void;
  pause: () => void;
  exportReport: (format: 'json' | 'md' | 'csv') => Promise<string>;
  runCompare: () => Promise<void>;
  setPolicy: (policy: Policy) => Promise<void>;
  setEngineMode: (engine: 'sim' | 'dispatch') => Promise<void>;
  configure: (partial: Partial<SessionConfig>) => Promise<void>;
  getSnapshot: () => EngineSnapshot | null;
  appendEvent: (event: EngineEvent) => void;
  syncEvents: () => Promise<void>;
}

function attachEventStream(sessionId: string, appendEvent: (e: EngineEvent) => void): EventSource | null {
  if (typeof EventSource === 'undefined') return null;
  const url = api.getEventsUrl ? api.getEventsUrl(sessionId) : `/api/sessions/${sessionId}/events`;
  const es = new EventSource(url);
  const handleEvent = (msg: MessageEvent) => {
    try {
      const parsed = JSON.parse(msg.data) as EngineEvent;
      if (parsed && parsed.type === 'event') appendEvent(parsed);
    } catch {
      /* heartbeat / non-json */
    }
  };

  es.onmessage = handleEvent;

  const eventTypes = [
    'process_arrived',
    'process_admitted',
    'process_dispatched',
    'process_demoted',
    'process_terminated',
    'memory_released',
    'alloc_failed',
    'idle',
    'sim_finished'
  ];

  if (typeof es.addEventListener === 'function') {
    for (const type of eventTypes) {
      es.addEventListener(type, handleEvent as EventListener);
    }
  }

  return es;
}

let initPromise: Promise<string | null> | null = null;

export const useSimStore = create<SimState>((set, get) => ({
  location: 'overview',
  sessionId: null,
  isInitializing: false,
  config: defaultConfig,
  events: [],
  snapshots: [],
  cursor: -1,
  playing: false,
  speed: 1,
  reducedMotion: false,
  viewMode: 'world',
  highContrast: false,
  selectedBlockIndex: null,
  oracleMessage: 'Welcome to MEMORY KINGDOM. Load the assignment dataset to begin.',
  compareResults: null,
  strategyViews: null,
  error: null,
  assumptions: ASSUMPTIONS,
  eventSource: null,
  playTimer: null,
  workloadSource: 'assignment',
  customJobs: null,
  activeWorkload: defaultWorkload,
  isCustomWorkloadOpen: false,

  setLocation: (id) => set({ location: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setReducedMotion: (v) => set({ reducedMotion: v }),
  setHighContrast: (v) => set({ highContrast: v }),
  setSpeed: (s) => {
    set({ speed: s });
    if (get().playing) {
      get().pause();
      get().start();
    }
  },
  setSelectedBlock: (i) => set({ selectedBlockIndex: i }),
  setCursor: (index) => set({ cursor: index }),
  openCustomWorkload: () => set({ isCustomWorkloadOpen: true }),
  closeCustomWorkload: () => set({ isCustomWorkloadOpen: false }),

  getSnapshot: () => {
    const { snapshots, cursor } = get();
    if (snapshots.length === 0) return null;
    if (cursor < 0 || cursor >= snapshots.length) return snapshots[snapshots.length - 1];
    return snapshots[cursor];
  },

  appendEvent: (event) => {
    set((s) => {
      if (s.events.some((e) => e.seq === event.seq)) {
        return s;
      }
      const next = [...s.events, event].sort((a, b) => a.seq - b.seq);
      return {
        events: next,
        oracleMessage: renderOracle(event)
      };
    });
  },

  syncEvents: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      const res = await api.getEvents(sessionId);
      if (res && res.data && Array.isArray(res.data)) {
        set((s) => {
          const existingSeqs = new Set(s.events.map((e) => e.seq));
          const newEvents = res.data.filter((e) => !existingSeqs.has(e.seq));
          if (newEvents.length === 0) return s;
          const merged = [...s.events, ...newEvents].sort((a, b) => a.seq - b.seq);
          return {
            events: merged,
            oracleMessage: merged.length > 0 ? renderOracle(merged[merged.length - 1]) : s.oracleMessage
          };
        });
      }
    } catch {
      // Best-effort sync
    }
  },

  ensureSession: async () => {
    const { sessionId } = get();
    if (sessionId) return sessionId;
    if (initPromise) {
      return initPromise;
    }
    await get().createSession();
    return get().sessionId;
  },

  createSession: async (partial = {}) => {
    if (initPromise) {
      await initPromise;
      if (Object.keys(partial).length === 0) {
        return;
      }
    }

    set({ isInitializing: true, error: null });

    const run = async (): Promise<string | null> => {
      try {
        const prev = get();
        prev.pause();
        if (prev.eventSource) prev.eventSource.close();
        if (prev.sessionId) {
          await api.deleteSession(prev.sessionId).catch(() => undefined);
        }

        const config = { ...defaultConfig, ...prev.config, ...partial };
        const res = await api.createSession(config);
        const sessionId = res.data.id;
        const es = attachEventStream(sessionId, (e) => get().appendEvent(e));

        set({
          sessionId,
          config: res.data.config ?? config,
          events: [],
          snapshots: [],
          cursor: -1,
          error: null,
          eventSource: es,
          compareResults: null,
          strategyViews: null,
          oracleMessage: `Session ${sessionId.slice(0, 8)}… ready (${config.policy}).`
        });

        await get().refreshSnapshot();
        await get().syncEvents();
        return sessionId;
      } finally {
        set({ isInitializing: false });
        initPromise = null;
      }
    };

    initPromise = run();
    try {
      await initPromise;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message, sessionId: null });
      throw err;
    }
  },

  destroySession: async () => {
    if (get().isInitializing) {
      return;
    }
    const { sessionId, eventSource, pause } = get();
    pause();
    if (eventSource) eventSource.close();
    if (sessionId) await api.deleteSession(sessionId).catch(() => undefined);
    set({
      sessionId: null,
      eventSource: null,
      events: [],
      snapshots: [],
      cursor: -1
    });
  },

  sendCommand: async (payload) => {
    let sessionId = get().sessionId;
    if (!sessionId) {
      sessionId = await get().ensureSession();
    }
    if (!sessionId) throw new Error('No active session');
    try {
      const res = await api.sendCommand(sessionId, payload);
      if (
        payload.cmd === 'sim.tick' ||
        payload.cmd === 'sim.run' ||
        payload.cmd === 'sim.reset' ||
        payload.cmd === 'workload.assignment' ||
        payload.cmd === 'workload.load' ||
        payload.cmd === 'workload.random' ||
        payload.cmd === 'arena.alloc' ||
        payload.cmd === 'arena.free' ||
        payload.cmd === 'arena.loadLayout' ||
        payload.cmd === 'session.configure'
      ) {
        await get().refreshSnapshot();
        void get().syncEvents();
      }
      return res.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      throw err;
    }
  },

  loadAssignment: async () => {
    // Restore 1024 MB memory capacity if it was altered by a custom workload
    if (get().config.totalMemory !== 1024 || !get().sessionId) {
      await get().createSession({ ...get().config, totalMemory: 1024 });
    } else {
      await get().sendCommand({
        cmd: 'session.configure',
        policy: get().config.policy,
        quantum: get().config.quantum,
        totalMemory: 1024,
        demotionTrigger: get().config.demotionTrigger,
        admissionOrdering: get().config.admissionOrdering
      });
    }

    await get().sendCommand({ cmd: 'workload.assignment' });
    const workload: ActiveWorkloadConfig = {
      source: 'assignment',
      totalMemory: 1024,
      quantum: 1
    };
    set({
      activeWorkload: workload,
      workloadSource: 'assignment',
      customJobs: null,
      config: { ...get().config, totalMemory: 1024 },
      events: [],
      snapshots: [],
      cursor: -1,
      compareResults: null,
      strategyViews: null,
      isCustomWorkloadOpen: false,
      oracleMessage: 'Assignment dataset loaded into the realm (1024 MB restored).'
    });
    await get().refreshSnapshot();
    await get().syncEvents();
  },

  loadRandom: async (seed = 1234, n = 8) => {
    await get().sendCommand({ cmd: 'workload.random', seed, n });
    const workload: ActiveWorkloadConfig = {
      source: 'random',
      seed,
      n,
      totalMemory: get().config.totalMemory,
      quantum: 1
    };
    set({
      activeWorkload: workload,
      workloadSource: 'random',
      customJobs: null,
      events: [],
      snapshots: [],
      cursor: -1,
      compareResults: null,
      strategyViews: null,
      oracleMessage: `Random workload (${n} jobs, seed ${seed}) loaded into the realm.`
    });
    await get().refreshSnapshot();
    await get().syncEvents();
  },

  loadCustomWorkload: async (jobs: Job[], totalMemory?: number) => {
    const memory = totalMemory ?? get().config.totalMemory ?? 1024;
    if (get().config.totalMemory !== memory || !get().sessionId) {
      await get().createSession({ ...get().config, totalMemory: memory });
    } else {
      await get().sendCommand({
        cmd: 'session.configure',
        policy: get().config.policy,
        quantum: get().config.quantum,
        totalMemory: memory,
        demotionTrigger: get().config.demotionTrigger,
        admissionOrdering: get().config.admissionOrdering
      });
    }

    await get().sendCommand({ cmd: 'workload.load', jobs });
    const workload: ActiveWorkloadConfig = {
      source: 'custom',
      jobs: [...jobs],
      totalMemory: memory,
      quantum: 1
    };
    set({
      activeWorkload: workload,
      workloadSource: 'custom',
      customJobs: [...jobs],
      config: { ...get().config, totalMemory: memory },
      events: [],
      snapshots: [],
      cursor: -1,
      compareResults: null,
      strategyViews: null,
      isCustomWorkloadOpen: false,
      oracleMessage: `Custom workload (${jobs.length} adventurers, ${memory} MB) loaded into the realm.`
    });
    await get().refreshSnapshot();
    await get().syncEvents();
  },

  tick: async () => {
    await get().sendCommand({ cmd: 'sim.tick' });
  },

  runUntil: async (untilT) => {
    await get().sendCommand({ cmd: 'sim.run', untilT });
  },

  reset: async () => {
    get().pause();
    const { sessionId, eventSource } = get();
    if (eventSource) eventSource.close();
    if (sessionId) {
      await api.deleteSession(sessionId).catch(() => undefined);
    }
    set({
      sessionId: null,
      eventSource: null,
      activeWorkload: null,
      workloadSource: 'assignment',
      customJobs: null,
      events: [],
      snapshots: [],
      cursor: -1,
      compareResults: null,
      strategyViews: null,
      selectedBlockIndex: null,
      isCustomWorkloadOpen: false,
      oracleMessage: 'No active dataset. Create a new dataset or load the assignment dataset to begin.'
    });
  },

  restart: async () => {
    get().pause();
    const { activeWorkload, config } = get();
    if (!activeWorkload) return;
    const targetMemory = activeWorkload.totalMemory ?? config.totalMemory ?? 1024;
    const targetQuantum = activeWorkload.quantum ?? 1;

    // 1. Create fresh session with saved workload configuration
    await get().createSession({
      ...config,
      totalMemory: targetMemory,
      quantum: targetQuantum
    });

    // 2. Load the active workload into the fresh C engine session
    if (activeWorkload.source === 'custom' && activeWorkload.jobs && activeWorkload.jobs.length > 0) {
      await get().sendCommand({ cmd: 'workload.load', jobs: activeWorkload.jobs });
    } else if (activeWorkload.source === 'random') {
      await get().sendCommand({
        cmd: 'workload.random',
        seed: activeWorkload.seed ?? 1234,
        n: activeWorkload.n ?? 8
      });
    } else {
      await get().sendCommand({ cmd: 'workload.assignment' });
    }

    // 3. Reset all simulation state (time, allocations, process states, queues, events, stats)
    set({
      events: [],
      snapshots: [],
      cursor: -1,
      compareResults: null,
      strategyViews: null,
      isCustomWorkloadOpen: false,
      oracleMessage:
        activeWorkload.source === 'custom' && activeWorkload.jobs
          ? `Simulation restarted with active custom workload (${activeWorkload.jobs.length} adventurers, ${targetMemory} MB).`
          : 'Simulation restarted with assignment dataset.'
    });

    // 4. Retrieve initial snapshot and sync
    await get().refreshSnapshot();
    await get().syncEvents();
  },

  refreshSnapshot: async () => {
    const { sessionId, snapshots, cursor } = get();
    if (!sessionId) return null;
    const res = await api.getSnapshot(sessionId);
    const snap = res.data;
    const next = [...snapshots, snap];
    // Cap history to keep memory bounded
    const capped = next.length > 500 ? next.slice(next.length - 500) : next;
    const live = cursor < 0 || cursor >= snapshots.length - 1;
    set({
      snapshots: capped,
      cursor: live ? -1 : cursor
    });
    return snap;
  },

  start: () => {
    const { playing, playTimer, speed, sessionId, activeWorkload } = get();
    if (playing || !sessionId || !activeWorkload) return;
    if (playTimer) clearInterval(playTimer);
    const timer = setInterval(() => {
      void get().tick().catch(() => get().pause());
    }, 1000 / speed);
    set({ playing: true, playTimer: timer });
  },

  pause: () => {
    const { playTimer } = get();
    if (playTimer) clearInterval(playTimer);
    set({ playing: false, playTimer: null });
  },

  exportReport: async (format) => {
    let sessionId = get().sessionId;
    if (!sessionId) {
      sessionId = await get().ensureSession();
    }
    if (!sessionId) throw new Error('No active session');
    return api.getReport(sessionId, format);
  },

  runCompare: async () => {
    set({ error: null });
    const { activeWorkload, config } = get();
    const isCustom = activeWorkload?.source === 'custom' && Boolean(activeWorkload.jobs && activeWorkload.jobs.length > 0);
    const jobs = isCustom ? activeWorkload.jobs : undefined;
    const totalMemory = isCustom ? (activeWorkload.totalMemory || config.totalMemory || 1024) : 1024;

    const compare = await api.runCompare(jobs, totalMemory);
    const policies: Policy[] = ['first_fit', 'next_fit', 'best_fit', 'worst_fit'];
    const views: PolicyMidRunView[] = [];

    if (isCustom && jobs) {
      for (const policy of policies) {
        const snap = await api.fetchCustomPolicySnapshot(policy, jobs, totalMemory);
        const offsets: Record<string, number> = {};
        if (snap && snap.processes) {
          for (const p of snap.processes) {
            offsets[p.name] = p.offset;
          }
        }
        if (snap && snap.arena) {
          views.push({
            policy,
            t: snap.t,
            nextFitOffset: snap.arena.nextFitOffset,
            offsets,
            blocks: snap.arena.blocks,
            statistics: snap.arena.statistics
          });
        }
      }
      set({
        compareResults: compare.data.results,
        strategyViews: views,
        oracleMessage: 'Custom workload strategy comparison complete (engine-sourced).'
      });
    } else {
      for (const policy of policies) {
        const snap = await api.fetchPolicySnapshotAt(policy);
        const offsets: Record<string, number> = {};
        if (snap && snap.processes) {
          for (const p of snap.processes) {
            if (p.pid >= 6 && p.pid <= 8) offsets[p.name] = p.offset;
          }
        }
        if (snap && snap.arena) {
          views.push({
            policy,
            t: snap.t,
            nextFitOffset: snap.arena.nextFitOffset,
            offsets,
            blocks: snap.arena.blocks,
            statistics: snap.arena.statistics,
            steps: snap.steps
          });
        }
      }
      set({
        compareResults: compare.data.results,
        strategyViews: views,
        oracleMessage: 'Strategy Room comparison complete (engine-sourced).'
      });
    }
  },

  setPolicy: async (policy) => {
    const snap = get().getSnapshot();
    if (snap && snap.t > 0) {
      set({
        error: 'Policy is locked after tick 0 of a scenario run. Restart required.'
      });
      return;
    }
    await get().configure({ policy });
  },

  setEngineMode: async (engine) => {
    await get().createSession({ ...get().config, engine });
  },

  configure: async (partial) => {
    const next = { ...get().config, ...partial };
    set({ config: next });
    if (!get().sessionId) {
      await get().createSession(next);
      return;
    }
    await get().sendCommand({
      cmd: 'session.configure',
      policy: next.policy,
      quantum: next.quantum,
      totalMemory: next.totalMemory,
      demotionTrigger: next.demotionTrigger,
      admissionOrdering: next.admissionOrdering
    });
  }
}));
