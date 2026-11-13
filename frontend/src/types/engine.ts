export type Policy = 'first_fit' | 'next_fit' | 'best_fit' | 'worst_fit';

export type ProcessState =
  | 'NOT_ARRIVED'
  | 'WAITING_FOR_MEMORY'
  | 'READY'
  | 'RUNNING'
  | 'SUSPENDED'
  | 'TERMINATED';

export type LocationId =
  | 'overview'
  | 'arena'
  | 'guild'
  | 'tavern'
  | 'castle'
  | 'dungeon'
  | 'strategy'
  | 'quests'
  | 'chronicles'
  | 'settings'
  | 'sprites';

export interface SessionConfig {
  policy: Policy;
  quantum: number;
  totalMemory: number;
  demotionTrigger: 'always' | 'only-if-contended';
  admissionOrdering: 'fifo-block' | 'skip-ahead';
  engine: 'sim' | 'dispatch';
}

export interface Job {
  arrival: number;
  priority: number;
  cpuBurst: number;
  memMb: number;
  printers?: number;
  scanners?: number;
  modems?: number;
  cds?: number;
  name?: string;
}

export interface ActiveWorkloadConfig {
  source: 'assignment' | 'custom' | 'random';
  jobs?: Job[];
  totalMemory: number;
  quantum: number;
  seed?: number;
  n?: number;
}

export interface BlockSnapshot {
  offset: number;
  size: number;
  allocated: boolean;
  pid: number;
  requestedSize?: number;
}

export interface ArenaStats {
  total: number;
  allocated: number;
  free: number;
  freeBlockCount: number;
  largestFree: number;
  smallestFree: number;
  utilization: number;
  externalFragmentation: number;
  isExternalFragUndefined: boolean;
  largestFreePctOfTotal: number;
  failedAttempts: number;
  processesDelayed: number;
  searchSteps: number;
  dragonPower: number;
  dragonTier: number;
  cracks: number;
  internalFragmentation?: number;
  allocationEfficiency?: number;
}

export interface ProcessSnapshot {
  pid: number;
  name: string;
  arrival: number;
  priority: number;
  cpuBurst: number;
  remaining: number;
  memMb: number;
  offset: number;
  state: string;
  queueLevel: number;
  admittedTime: number;
  finishTime: number;
  waitedForMemory: number;
}

export interface EngineSnapshot {
  t: number;
  seq: number;
  runningPid: number;
  isFinished: boolean;
  queues: {
    input: number[];
    userJob: number[];
    q1: number[];
    q2: number[];
    q3: number[];
  };
  arena: {
    total: number;
    nextFitOffset: number;
    blocks: BlockSnapshot[];
    statistics: ArenaStats;
  };
  processes: ProcessSnapshot[];
}

export interface EngineEvent {
  type: 'event';
  seq: number;
  t: number;
  kind: string;
  data: Record<string, unknown>;
}

export interface ComparePolicyResult {
  policy: Policy | string;
  successfulAttempts: number;
  failedAttempts: number;
  processesDelayed: number;
  totalFree: number;
  largestFree: number;
  freeBlockCount: number;
  utilization: number;
  externalFragmentation: number;
  totalSearchSteps: number;
  avgMemoryWait: number;
  avgTurnaround: number;
  makespan: number;
}

export interface BlockExamined {
  offset: number;
  size: number;
  verdict: 'accepted' | 'rejected' | 'skipped';
}

export interface AllocationStep {
  step: number;
  processName: string;
  requestSize: number;
  allocatedOffset: number | null;
  allocatedSize: number | null;
  freeBlocksBefore: Array<{ offset: number; size: number }>;
  blocksExamined: BlockExamined[];
  reason: string;
  nextFitOffset: number;
  statistics: ArenaStats;
  blocks: BlockSnapshot[];
}

export interface PolicyMidRunView {
  policy: Policy;
  t: number;
  nextFitOffset: number;
  offsets: Record<string, number>;
  blocks: BlockSnapshot[];
  statistics: ArenaStats;
  steps?: AllocationStep[];
}

export interface AssumptionRow {
  id: string;
  rule: string;
  defaultValue: string;
  status: 'UNVERIFIED' | 'VERIFIED';
}
