import type { EngineEvent } from '../types/engine';

const POLICY_LABEL: Record<string, string> = {
  first_fit: 'First Fit',
  next_fit: 'Next Fit',
  best_fit: 'Best Fit',
  worst_fit: 'Worst Fit'
};

function num(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === 'number' ? String(v) : String(v ?? '?');
}

function str(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return v === undefined || v === null ? '?' : String(v);
}

/** Deterministic Oracle dialogue from event fields only — no AI, no recomputation. */
export function renderOracle(event: EngineEvent): string {
  const d = event.data ?? {};
  const t = event.t;
  switch (event.kind) {
    case 'process_arrived':
      return `t=${t}: P${num(d, 'pid')} arrived requesting ${num(d, 'memMb')} MB (burst ${num(d, 'cpuBurst')}).`;
    case 'process_admitted': {
      const policy = POLICY_LABEL[str(d, 'policy')] ?? str(d, 'policy');
      return `t=${t}: P${num(d, 'pid')} admitted by ${policy} at offset ${num(d, 'offset')}; ${num(d, 'size')} MB allocated.`;
    }
    case 'process_dispatched':
      return `t=${t}: P${num(d, 'pid')} (${str(d, 'name')}) dispatched from Q${num(d, 'queueLevel')} with ${num(d, 'remaining')} remaining.`;
    case 'process_demoted':
      return `t=${t}: P${num(d, 'pid')} demoted to queue level ${num(d, 'queueLevel')} (remaining ${num(d, 'remaining')}).`;
    case 'process_terminated':
      return `t=${t}: P${num(d, 'pid')} terminated after completing its CPU burst.`;
    case 'memory_released':
      return `t=${t}: Memory released for P${num(d, 'pid')} at offset ${num(d, 'offset')} (size ${num(d, 'size')} MB); neighbors examined for merge.`;
    case 'alloc_failed':
      return `t=${t}: Allocation failed for P${num(d, 'pid')} requesting ${num(d, 'size')} MB — reason ${str(d, 'reason')}.`;
    case 'idle':
      return `t=${t}: Realm idle — no runnable process this tick.`;
    case 'sim_finished':
      return `t=${t}: Simulation finished. All adventurers have left the realm.`;
    case 'process_suspended':
      return `t=${t}: P${num(d, 'pid')} suspended (SIGTSTP).`;
    case 'process_resumed':
      return `t=${t}: P${num(d, 'pid')} resumed (SIGCONT).`;
    case 'queue_moved':
      return `t=${t}: P${num(d, 'pid')} moved from ${str(d, 'from')} to ${str(d, 'to')}.`;
    case 'block_split':
      return `t=${t}: Block at ${num(d, 'offset')} split — allocated ${num(d, 'allocSize')} MB, remainder ${num(d, 'remainSize')} MB.`;
    case 'block_merged':
      return `t=${t}: Free blocks merged into offset ${num(d, 'offset')} size ${num(d, 'size')} MB.`;
    case 'search_trace':
      return `t=${t}: Search examined ${num(d, 'steps')} blocks; chosen offset ${num(d, 'chosenOffset')}.`;
    default:
      return `t=${t}: Event ${event.kind} (seq ${event.seq}).`;
  }
}

export const ORACLE_EVENT_KINDS = [
  'process_arrived',
  'process_admitted',
  'process_dispatched',
  'process_demoted',
  'process_terminated',
  'memory_released',
  'alloc_failed',
  'idle',
  'sim_finished',
  'process_suspended',
  'process_resumed',
  'queue_moved',
  'block_split',
  'block_merged',
  'search_trace'
] as const;
