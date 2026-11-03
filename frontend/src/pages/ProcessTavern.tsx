import { useSimStore } from '../store/simStore';

export function ProcessTavern() {
  const snap = useSimStore((s) => s.getSnapshot());
  const loadAssignment = useSimStore((s) => s.loadAssignment);
  const loadRandom = useSimStore((s) => s.loadRandom);
  const reset = useSimStore((s) => s.reset);

  return (
    <section data-testid="page-tavern" className="space-y-4">
      <header>
        <h2 className="font-pixel text-sm text-gold-2">Process Tavern</h2>
        <p className="mt-1 text-xs text-stone-2">
          Adventurers await the gate. Workload changes are validated by the engine/API.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" data-testid="tavern-load-assignment" onClick={() => void loadAssignment()}>
          Load assignment
        </button>
        <button
          type="button"
          className="btn"
          data-testid="tavern-random"
          onClick={() => void loadRandom(1234, 8)}
        >
          Seeded random
        </button>
        <button type="button" className="btn" data-testid="tavern-reset" onClick={() => void reset()}>
          Reset
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs" data-testid="process-table">
          <thead>
            <tr className="border-b border-ink-3 text-stone-2">
              <th className="p-1">PID</th>
              <th className="p-1">Name</th>
              <th className="p-1">Arrival</th>
              <th className="p-1">Pri</th>
              <th className="p-1">Burst</th>
              <th className="p-1">Remain</th>
              <th className="p-1">Mem</th>
              <th className="p-1">Offset</th>
              <th className="p-1">State</th>
              <th className="p-1">Q</th>
            </tr>
          </thead>
          <tbody>
            {(snap?.processes ?? []).map((p) => (
              <tr key={p.pid} className="border-b border-ink-2/40" data-testid={`process-row-${p.pid}`}>
                <td className="p-1">{p.pid}</td>
                <td className="p-1">{p.name}</td>
                <td className="p-1">{p.arrival}</td>
                <td className="p-1">{p.priority}</td>
                <td className="p-1">{p.cpuBurst}</td>
                <td className="p-1">{p.remaining}</td>
                <td className="p-1">{p.memMb}</td>
                <td className="p-1">{p.offset}</td>
                <td className="p-1">{p.state}</td>
                <td className="p-1">{p.queueLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
