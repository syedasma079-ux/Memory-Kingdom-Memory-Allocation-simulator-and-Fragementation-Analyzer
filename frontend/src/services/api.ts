import type {
  ComparePolicyResult,
  EngineSnapshot,
  Job,
  Policy,
  SessionConfig
} from '../types/engine';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
  const res = await fetch(`${BASE}/api/sessions/${id}/report?format=${format}`);
  if (!res.ok) throw new Error(`Report failed: ${res.status}`);
  return res.text();
}

export async function runCompare(jobs?: Job[]): Promise<{ ok: boolean; data: { results: ComparePolicyResult[] } }> {
  return request('/api/compare', {
    method: 'POST',
    body: JSON.stringify(jobs ? { jobs } : {})
  });
}

/**
 * Fetch the G2/G3 mid-run snapshot for a policy: assignment through t=6, then two
 * ticks so P6–P8 are admitted. Offsets and stats come from the engine snapshot.
 */
export async function fetchPolicySnapshotAt(policy: Policy, untilT = 6): Promise<EngineSnapshot> {
  const created = await createSession({ policy, quantum: 1, totalMemory: 1024, engine: 'sim' });
  const id = created.data.id;
  try {
    await sendCommand(id, { cmd: 'workload.assignment' });
    await sendCommand(id, { cmd: 'sim.run', untilT });
    await sendCommand(id, { cmd: 'sim.tick' });
    await sendCommand(id, { cmd: 'sim.tick' });
    const snap = await getSnapshot(id);
    return snap.data;
  } finally {
    await deleteSession(id).catch(() => undefined);
  }
}

export function openEventStream(id: string, onEvent: (raw: MessageEvent) => void): EventSource {
  const es = new EventSource(`${BASE}/api/sessions/${id}/events`);
  es.onmessage = onEvent;
  return es;
}
