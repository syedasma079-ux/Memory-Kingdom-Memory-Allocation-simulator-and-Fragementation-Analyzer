import { useMemo, useState } from 'react';
import { useSimStore } from '../store/simStore';

const KINDS = [
  'all',
  'process_arrived',
  'process_admitted',
  'process_dispatched',
  'process_demoted',
  'process_terminated',
  'memory_released',
  'alloc_failed',
  'idle',
  'sim_finished'
] as const;

export function Chronicles() {
  const events = useSimStore((s) => s.events);
  const snapshots = useSimStore((s) => s.snapshots);
  const setCursor = useSimStore((s) => s.setCursor);
  const [filter, setFilter] = useState<(typeof KINDS)[number]>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.kind === filter)),
    [events, filter]
  );

  return (
    <section data-testid="page-chronicles" className="space-y-4">
      <header>
        <h2 className="font-pixel text-sm text-gold-2">Simulation Chronicles</h2>
        <p className="mt-1 text-xs text-stone-2">
          Filterable event log. Scrubber restores real snapshots (D6).
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="btn"
            data-testid={`chronicles-filter-${k}`}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {k}
          </button>
        ))}
      </div>

      <ol className="panel max-h-[420px] space-y-1 overflow-auto p-3 font-mono text-[11px]" data-testid="event-log">
        {filtered.length === 0 && <li className="text-stone-2">No events yet.</li>}
        {filtered.map((e) => (
          <li key={`${e.seq}-${e.kind}`}>
            <button
              type="button"
              className="w-full text-left hover:bg-ink-2"
              data-testid={`event-seq-${e.seq}`}
              onClick={() => {
                const idx = snapshots.findIndex((s) => s.seq >= e.seq);
                if (idx >= 0) setCursor(idx);
              }}
            >
              [{e.seq}] t={e.t} {e.kind} {JSON.stringify(e.data)}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
