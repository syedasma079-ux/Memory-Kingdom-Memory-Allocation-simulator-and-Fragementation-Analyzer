import { z } from 'zod';

export const PolicySchema = z.enum(['first_fit', 'next_fit', 'best_fit', 'worst_fit']);
export type Policy = z.infer<typeof PolicySchema>;

export const ProcessStateSchema = z.enum([
  'NOT_ARRIVED',
  'WAITING_FOR_MEMORY',
  'READY',
  'RUNNING',
  'SUSPENDED',
  'TERMINATED'
]);

export const DemotionTriggerSchema = z.enum(['always', 'only-if-contended']);
export const AdmissionOrderingSchema = z.enum(['fifo-block', 'skip-ahead']);

export const SessionConfigSchema = z.object({
  policy: PolicySchema.default('first_fit'),
  quantum: z.number().int().positive().default(1),
  totalMemory: z.number().int().positive().default(1024),
  demotionTrigger: DemotionTriggerSchema.default('always'),
  admissionOrdering: AdmissionOrderingSchema.default('fifo-block'),
  engine: z.enum(['sim', 'dispatch']).default('sim')
});
export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export const JobSchema = z.object({
  arrival: z.number().int().nonnegative(),
  priority: z.number().int().min(1).max(3),
  cpuBurst: z.number().int().positive(),
  memMb: z.number().int().positive(),
  printers: z.number().int().nonnegative().default(0),
  scanners: z.number().int().nonnegative().default(0),
  modems: z.number().int().nonnegative().default(0),
  cds: z.number().int().nonnegative().default(0)
});
export type Job = z.infer<typeof JobSchema>;

export const CommandPayloadSchema = z.discriminatedUnion('cmd', [
  z.object({
    cmd: z.literal('session.configure'),
    policy: PolicySchema.optional(),
    quantum: z.number().int().positive().optional(),
    totalMemory: z.number().int().positive().optional(),
    demotionTrigger: DemotionTriggerSchema.optional(),
    admissionOrdering: AdmissionOrderingSchema.optional()
  }),
  z.object({
    cmd: z.literal('workload.assignment')
  }),
  z.object({
    cmd: z.literal('workload.load'),
    jobs: z.array(JobSchema).max(500)
  }),
  z.object({
    cmd: z.literal('workload.random'),
    seed: z.number().int().default(1234),
    n: z.number().int().min(1).max(64).default(8)
  }),
  z.object({
    cmd: z.literal('sim.tick')
  }),
  z.object({
    cmd: z.literal('sim.run'),
    untilT: z.number().int().optional()
  }),
  z.object({
    cmd: z.literal('sim.reset')
  }),
  z.object({
    cmd: z.literal('sim.seek'),
    seq: z.number().int().nonnegative()
  }),
  z.object({
    cmd: z.literal('snapshot.get')
  }),
  z.object({
    cmd: z.literal('arena.alloc'),
    pid: z.number().int().default(-1),
    size: z.number().int().positive()
  }),
  z.object({
    cmd: z.literal('arena.free'),
    pid: z.number().int().optional(),
    offset: z.number().int().optional()
  }),
  z.object({
    cmd: z.literal('arena.loadLayout'),
    blocks: z.array(z.object({
      size: z.number().int().positive(),
      allocated: z.number().int().min(0).max(1)
    }))
  }),
  z.object({
    cmd: z.literal('compare.run')
  })
]);
export type CommandPayload = z.infer<typeof CommandPayloadSchema>;

export interface BlockSnapshot {
  offset: number;
  size: number;
  allocated: boolean;
  pid: number;
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
