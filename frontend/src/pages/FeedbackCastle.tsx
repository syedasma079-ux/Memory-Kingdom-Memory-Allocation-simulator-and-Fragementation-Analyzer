import { useSimStore } from '../store/simStore';

function QueueColumn({ title, pids, testId }: { title: string; pids: number[]; testId: string }) {
  return (
    <div className="panel min-h-[140px] p-3" data-testid={testId}>
      <h3 className="font-pixel text-[9px] text-gold-3">{title}</h3>
      <ul className="mt-2 space-y-1 font-mono text-xs">
        {pids.length === 0 && <li className="text-stone-2">(empty)</li>}
        {pids.map((pid) => (
          <li key={pid} className="border border-ink-3 bg-ink-0 px-2 py-1">
            P{pid}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeedbackCastle() {
  const snap = useSimStore((s) => s.getSnapshot());
  const config = useSimStore((s) => s.config);
  const setEngineMode = useSimStore((s) => s.setEngineMode);
  const q = snap?.queues;

  return (
    <section data-testid="page-castle" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-pixel text-sm text-gold-2">Feedback Queue Castle</h2>
          <p className="mt-1 text-xs text-stone-2">
            Queues mirror the engine snapshot. Linux mode uses memk-dispatch (real PIDs/signals).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn"
            data-testid="castle-mode-sim"
            aria-pressed={config.engine === 'sim'}
            onClick={() => void setEngineMode('sim')}
          >
            Virtual
          </button>
          <button
            type="button"
            className="btn"
            data-testid="castle-mode-dispatch"
            aria-pressed={config.engine === 'dispatch'}
            onClick={() => void setEngineMode('dispatch')}
          >
            Linux
          </button>
        </div>
      </header>

      <p className="label-chip" data-testid="castle-engine">
        Engine: {config.engine}
      </p>
      <p className="label-chip" data-testid="castle-running">
        Running slot:{' '}
        {(snap?.runningPid ?? -1) >= 0 ? `P${snap?.runningPid}` : '(idle)'}
      </p>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        <QueueColumn title="Input" pids={q?.input ?? []} testId="queue-input" />
        <QueueColumn title="User Job" pids={q?.userJob ?? []} testId="queue-userjob" />
        <QueueColumn title="Q1" pids={q?.q1 ?? []} testId="queue-q1" />
        <QueueColumn title="Q2" pids={q?.q2 ?? []} testId="queue-q2" />
        <QueueColumn title="Q3" pids={q?.q3 ?? []} testId="queue-q3" />
      </div>
    </section>
  );
}
