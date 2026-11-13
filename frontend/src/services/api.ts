import type {
  AllocationStep,
  BlockExamined,
  ComparePolicyResult,
  EngineEvent,
  EngineSnapshot,
  Job,
  Policy,
  SessionConfig
} from '../types/engine';

function getBase(): string {
  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL);
  }
  const procEnv = (globalThis as unknown as { process?: { env?: Record<string, string> } })?.process?.env;
  if (procEnv?.VITE_API_URL) {
    return procEnv.VITE_API_URL;
  }
  return '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err =
      body && typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(err);
  }
  return body as T;
}

export async function getHealth(): Promise<{ status: string; uptime: number; activeSessions: number }> {
  return request('/api/health');
}

export async function getAssignmentDataset(): Promise<{ ok: boolean; data: Job[] }> {
  return request('/api/dataset/assignment');
}

export async function createSession(
  config: Partial<SessionConfig> = {}
): Promise<{ ok: boolean; data: { id: string; config: SessionConfig } }> {
  return request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

export async function deleteSession(id: string): Promise<{ ok: boolean }> {
  return request(`/api/sessions/${id}`, { method: 'DELETE' });
}

export async function sendCommand<T = unknown>(
  id: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data: T }> {
  return request(`/api/sessions/${id}/commands`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getSnapshot(id: string): Promise<{ ok: boolean; data: EngineSnapshot }> {
  return request(`/api/sessions/${id}/snapshot`);
}

export async function getReport(id: string, format: 'json' | 'md' | 'csv' = 'json'): Promise<string> {
  const res = await fetch(`${getBase()}/api/sessions/${id}/report?format=${format}`);
  if (!res.ok) throw new Error(`Report failed: ${res.status}`);
  return res.text();
}

export function getEventsUrl(id: string): string {
  return `${getBase()}/api/sessions/${id}/events`;
}

export async function getEvents(id: string): Promise<{ ok: boolean; data: EngineEvent[] }> {
  return request(`/api/sessions/${id}/events?format=json`);
}

export async function runCompare(
  jobs?: Job[],
  totalMemory?: number
): Promise<{ ok: boolean; data: { results: ComparePolicyResult[] } }> {
  return request('/api/compare', {
    method: 'POST',
    body: JSON.stringify({
      ...(jobs ? { jobs } : {}),
      ...(totalMemory ? { totalMemory } : {})
    })
  });
}

/**
 * Run a custom workload through a temporary session for a single policy to get
 * the real C-engine layout, final blocks, and statistics.
 */
export async function fetchCustomPolicySnapshot(
  policy: Policy,
  jobs: Job[],
  totalMemory = 1024
): Promise<EngineSnapshot> {
  const created = await createSession({ policy, quantum: 1, totalMemory, engine: 'sim' });
  const id = created.data.id;
  try {
    await sendCommand(id, { cmd: 'workload.load', jobs });
    await sendCommand(id, { cmd: 'sim.run', untilT: -1 });
    const snap = await getSnapshot(id);
    return snap.data;
  } finally {
    await deleteSession(id).catch(() => undefined);
  }
}

function getPolicyStepReason(
  policy: Policy,
  size: number,
  freeBefore: Array<{ offset: number; size: number }>,
  chosenOffset: number | null,
  prevNextFit: number
): { examined: BlockExamined[]; reason: string } {
  const chosenBlock = freeBefore.find((b) => b.offset === chosenOffset);
  const examined: BlockExamined[] = [];
  let reason = '';

  if (chosenOffset === null || !chosenBlock) {
    return {
      examined: freeBefore.map((b) => ({ ...b, verdict: 'rejected' })),
      reason: `No adequate free block available for request of ${size} MB.`
    };
  }

  if (policy === 'first_fit') {
    for (const b of freeBefore) {
      if (b.offset < chosenOffset) {
        examined.push({ ...b, verdict: 'rejected' });
      } else if (b.offset === chosenOffset) {
        examined.push({ ...b, verdict: 'accepted' });
        break;
      }
    }
    const skipped = freeBefore.filter((b) => b.offset > chosenOffset);
    for (const b of skipped) {
      examined.push({ ...b, verdict: 'skipped' });
    }
    reason = `Scanned from 0; first adequate block is [${chosenOffset}..${chosenOffset + chosenBlock.size}] (${chosenBlock.size} MB >= ${size} MB).`;
  } else if (policy === 'next_fit') {
    const sorted = [...freeBefore].sort((a, b) => a.offset - b.offset);
    const startIdx = sorted.findIndex((b) => b.offset >= prevNextFit);
    const order: Array<{ offset: number; size: number }> = [];
    if (startIdx >= 0) {
      for (let i = startIdx; i < sorted.length; i++) order.push(sorted[i]);
      for (let i = 0; i < startIdx; i++) order.push(sorted[i]);
    } else {
      for (const b of sorted) order.push(b);
    }
    for (const b of order) {
      if (b.offset === chosenOffset) {
        examined.push({ ...b, verdict: 'accepted' });
        break;
      } else {
        examined.push({ ...b, verdict: 'rejected' });
      }
    }
    const seen = new Set(examined.map((e) => e.offset));
    for (const b of freeBefore) {
      if (!seen.has(b.offset)) {
        examined.push({ ...b, verdict: 'skipped' });
      }
    }
    reason = `Scanned from NextFit pointer ${prevNextFit}; first adequate block is [${chosenOffset}..${chosenOffset + chosenBlock.size}] (${chosenBlock.size} MB >= ${size} MB). Pointer moves to ${(chosenOffset + size) % 1024}.`;
  } else if (policy === 'best_fit') {
    for (const b of freeBefore) {
      if (b.offset === chosenOffset) {
        examined.push({ ...b, verdict: 'accepted' });
      } else {
        examined.push({ ...b, verdict: 'rejected' });
      }
    }
    const remainder = chosenBlock.size - size;
    reason = `Evaluated all ${freeBefore.length} free blocks; tightest fit is [${chosenOffset}..${chosenOffset + chosenBlock.size}] (${chosenBlock.size} MB), leaving minimal ${remainder} MB remainder.`;
  } else if (policy === 'worst_fit') {
    for (const b of freeBefore) {
      if (b.offset === chosenOffset) {
        examined.push({ ...b, verdict: 'accepted' });
      } else {
        examined.push({ ...b, verdict: 'rejected' });
      }
    }
    const remainder = chosenBlock.size - size;
    reason = `Evaluated all ${freeBefore.length} free blocks; largest block is [${chosenOffset}..${chosenOffset + chosenBlock.size}] (${chosenBlock.size} MB), leaving largest ${remainder} MB remainder.`;
  }

  return { examined, reason };
}

/**
 * Fetch the G2/G3 mid-run snapshot for a policy: assignment through t=6, then step-by-step
 * allocation for P6, P7, P8 through the C engine. Offsets, blocks, and stats come from the engine.
 */
export async function fetchPolicySnapshotAt(
  policy: Policy,
  untilT = 6
): Promise<EngineSnapshot & { steps?: AllocationStep[] }> {
  const created = await createSession({ policy, quantum: 1, totalMemory: 1024, engine: 'sim' });
  const id = created.data.id;
  try {
    await sendCommand(id, { cmd: 'workload.assignment' });
    await sendCommand(id, { cmd: 'sim.run', untilT });

    const step0Snap = await getSnapshot(id);
    const steps: AllocationStep[] = [];

    const initialFreeBlocks = step0Snap.data.arena.blocks
      .filter((b) => !b.allocated)
      .map((b) => ({ offset: b.offset, size: b.size }));

    steps.push({
      step: 0,
      processName: 'Initial (t=6)',
      requestSize: 0,
      allocatedOffset: null,
      allocatedSize: null,
      freeBlocksBefore: initialFreeBlocks,
      blocksExamined: initialFreeBlocks.map((b) => ({ ...b, verdict: 'skipped' })),
      reason: 'G1 baseline layout at t=6: P1(32MB), P3(32MB), P5(128MB) allocated. 4 free holes (832 MB total).',
      nextFitOffset: step0Snap.data.arena.nextFitOffset,
      statistics: step0Snap.data.arena.statistics,
      blocks: step0Snap.data.arena.blocks
    });

    const admissions = [
      { pid: 6, name: 'P6', size: 108 },
      { pid: 7, name: 'P7', size: 256 },
      { pid: 8, name: 'P8', size: 80 }
    ];

    for (let i = 0; i < admissions.length; i++) {
      const target = admissions[i];
      const prevStep = steps[steps.length - 1];
      const freeBefore = prevStep.blocks
        .filter((b) => !b.allocated)
        .map((b) => ({ offset: b.offset, size: b.size }));

      const allocRes = await sendCommand<{ offset: number; size: number }>(id, {
        cmd: 'arena.alloc',
        pid: target.pid,
        size: target.size
      });
      const snap = await getSnapshot(id);

      const chosenOffset = allocRes.data?.offset ?? null;
      const chosenSize = allocRes.data?.size ?? target.size;

      const { examined, reason } = getPolicyStepReason(
        policy,
        target.size,
        freeBefore,
        chosenOffset,
        prevStep.nextFitOffset
      );

      steps.push({
        step: i + 1,
        processName: target.name,
        requestSize: target.size,
        allocatedOffset: chosenOffset,
        allocatedSize: chosenSize,
        freeBlocksBefore: freeBefore,
        blocksExamined: examined,
        reason,
        nextFitOffset: snap.data.arena.nextFitOffset,
        statistics: snap.data.arena.statistics,
        blocks: snap.data.arena.blocks
      });
    }

    const finalSnap = steps[steps.length - 1].blocks
      ? (await getSnapshot(id)).data
      : step0Snap.data;

    const processes = step0Snap.data.processes.map((p) => {
      const match = steps.find((s) => s.processName === p.name);
      if (match && match.allocatedOffset !== null) {
        return { ...p, offset: match.allocatedOffset };
      }
      return p;
    });

    return {
      ...finalSnap,
      processes,
      steps
    };
  } finally {
    await deleteSession(id).catch(() => undefined);
  }
}

export function openEventStream(id: string, onEvent: (raw: MessageEvent) => void): EventSource {
  const es = new EventSource(`${getBase()}/api/sessions/${id}/events`);
  es.onmessage = onEvent;
  return es;
}
