import { useSimStore } from '../store/simStore';

export function TimeControls() {
  const snap = useSimStore((s) => s.getSnapshot());
  const playing = useSimStore((s) => s.playing);
  const speed = useSimStore((s) => s.speed);
  const start = useSimStore((s) => s.start);
  const pause = useSimStore((s) => s.pause);
  const tick = useSimStore((s) => s.tick);
  const reset = useSimStore((s) => s.reset);
  const restart = useSimStore((s) => s.restart);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const loadAssignment = useSimStore((s) => s.loadAssignment);
  const exportReport = useSimStore((s) => s.exportReport);
  const cursor = useSimStore((s) => s.cursor);
  const snapshots = useSimStore((s) => s.snapshots);
  const setCursor = useSimStore((s) => s.setCursor);

  const onExport = async (format: 'json' | 'md' | 'csv') => {
    const text = await exportReport(format);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-kingdom-report.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b-2 border-ink-3 bg-ink-1/90 px-3 py-2"
      data-testid="time-controls"
    >
      <span className="label-chip" data-testid="sim-clock">
        t = {snap?.t ?? 0}
      </span>
      <span className="label-chip">seq = {snap?.seq ?? 0}</span>
      <button type="button" className="btn" data-testid="ctrl-start" onClick={start} disabled={playing}>
        Start
      </button>
      <button type="button" className="btn" data-testid="ctrl-pause" onClick={pause} disabled={!playing}>
        Pause
      </button>
      <button type="button" className="btn" data-testid="ctrl-tick" onClick={() => void tick()}>
        Step Tick
      </button>
      <button type="button" className="btn" data-testid="ctrl-reset" onClick={() => void reset()}>
        Reset
      </button>
      <button type="button" className="btn" data-testid="ctrl-restart" onClick={() => void restart()}>
        Restart
      </button>
      {([1, 2, 4] as const).map((s) => (
        <button
          key={s}
          type="button"
          className="btn"
          data-testid={`ctrl-speed-${s}`}
          aria-pressed={speed === s}
          onClick={() => setSpeed(s)}
        >
          {s}x
        </button>
      ))}
      <button type="button" className="btn" data-testid="ctrl-load-assignment" onClick={() => void loadAssignment()}>
        Load sample
      </button>
      <button type="button" className="btn" data-testid="ctrl-export-json" onClick={() => void onExport('json')}>
        Export JSON
      </button>
      <button type="button" className="btn" data-testid="ctrl-export-md" onClick={() => void onExport('md')}>
        Export MD
      </button>
      <button type="button" className="btn" data-testid="ctrl-export-csv" onClick={() => void onExport('csv')}>
        Export CSV
      </button>
      {snapshots.length > 0 && (
        <label className="ml-auto flex items-center gap-2 text-[10px] text-stone-2">
          Scrubber
          <input
            data-testid="ctrl-scrubber"
            type="range"
            min={0}
            max={Math.max(0, snapshots.length - 1)}
            value={cursor < 0 ? snapshots.length - 1 : cursor}
            onChange={(e) => setCursor(Number(e.target.value))}
          />
        </label>
      )}
    </div>
  );
}
