import { create } from 'zustand';
import { ASSUMPTIONS } from '../data/assumptions';
import { renderOracle } from '../oracle/templates';
import * as api from '../services/api';
import type {
  AssumptionRow,
  ComparePolicyResult,
  EngineEvent,
  EngineSnapshot,
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

interface SimState {
  location: LocationId;
  sessionId: string | null;
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

  setLocation: (id: LocationId) => void;
  setViewMode: (mode: 'world' | 'technical') => void;
  setReducedMotion: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setSpeed: (s: 1 | 2 | 4) => void;
  setSelectedBlock: (i: number | null) => void;
  setCursor: (index: number) => void;
  createSession: (partial?: Partial<SessionConfig>) => Promise<void>;
  destroySession: () => Promise<void>;
  sendCommand: (payload: Record<string, unknown>) => Promise<unknown>;
  loadAssignment: () => Promise<void>;
  loadRandom: (seed?: number, n?: number) => Promise<void>;
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
}

function attachEventStream(sessionId: string, appendEvent: (e: EngineEvent) => void): EventSource {
  const es = new EventSource(`/api/sessions/${sessionId}/events`);
  es.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data) as EngineEvent;
      if (parsed && parsed.type === 'event') appendEvent(parsed);
    } catch {
      /* heartbeat / non-json */
    }
  };
  return es;
}

export const useSimStore = create<SimState>((set, get) => ({
  location: 'overview',
  sessionId: null,
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

  getSnapshot: () => {
    const { snapshots, cursor } = get();
    if (snapshots.length === 0) return null;
    if (cursor < 0 || cursor >= snapshots.length) return snapshots[snapshots.length - 1];
    return snapshots[cursor];
  },

  appendEvent: (event) => {
    set((s) => ({
      events: [...s.events, event],
      oracleMessage: renderOracle(event)
    }));
  },

  createSession: async (partial = {}) => {
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
  },

  destroySession: async () => {
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
    const { sessionId } = get();
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
      }
      return res.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ error: message });
      throw err;
    }
  },

  loadAssignment: async () => {
    await get().sendCommand({ cmd: 'workload.assignment' });
    set({ oracleMessage: 'Assignment dataset loaded into the realm.' });
  },

  loadRandom: async (seed = 1234, n = 8) => {
    await get().sendCommand({ cmd: 'workload.random', seed, n });
  },

  tick: async () => {
    await get().sendCommand({ cmd: 'sim.tick' });
  },

  runUntil: async (untilT) => {
    await get().sendCommand({ cmd: 'sim.run', untilT });
  },

  reset: async () => {
    await get().sendCommand({ cmd: 'sim.reset' });
    set({ events: [], snapshots: [], cursor: -1 });
    await get().refreshSnapshot();
  },

  restart: async () => {
    const { config } = get();
    await get().createSession(config);
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
    const { playing, playTimer, speed } = get();
    if (playing) return;
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
    const { sessionId } = get();
    if (!sessionId) throw new Error('No active session');
    return api.getReport(sessionId, format);
  },

  runCompare: async () => {
    set({ error: null });
    const compare = await api.runCompare();
    const policies: Policy[] = ['first_fit', 'next_fit', 'best_fit', 'worst_fit'];
    const views: PolicyMidRunView[] = [];
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
          statistics: snap.arena.statistics
        });
      }
    }
    set({
      compareResults: compare.data.results,
      strategyViews: views,
      oracleMessage: 'Strategy Room comparison complete (engine-sourced).'
    });
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
