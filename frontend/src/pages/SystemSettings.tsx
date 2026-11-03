import { useSimStore } from '../store/simStore';

export function SystemSettings() {
  const reducedMotion = useSimStore((s) => s.reducedMotion);
  const setReducedMotion = useSimStore((s) => s.setReducedMotion);
  const viewMode = useSimStore((s) => s.viewMode);
  const setViewMode = useSimStore((s) => s.setViewMode);
  const speed = useSimStore((s) => s.speed);
  const setSpeed = useSimStore((s) => s.setSpeed);
  const highContrast = useSimStore((s) => s.highContrast);
  const setHighContrast = useSimStore((s) => s.setHighContrast);
  const config = useSimStore((s) => s.config);
  const configure = useSimStore((s) => s.configure);
  const assumptions = useSimStore((s) => s.assumptions);

  return (
    <section data-testid="page-settings" className="space-y-4">
      <header>
        <h2 className="font-pixel text-sm text-gold-2">System Settings</h2>
        <p className="mt-1 text-xs text-stone-2">
          Sound is off by default and not required. Total memory is locked to 1024 in Assignment mode.
        </p>
      </header>

      <div className="panel space-y-3 p-4">
        <label className="flex items-center gap-2 text-xs">
          <input
            data-testid="settings-reduced-motion"
            type="checkbox"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
          />
          Reduced motion
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            data-testid="settings-high-contrast"
            type="checkbox"
            checked={highContrast}
            onChange={(e) => setHighContrast(e.target.checked)}
          />
          High contrast
        </label>
        <fieldset className="text-xs">
          <legend>Default view</legend>
          <label className="mr-3">
            <input
              type="radio"
              name="view"
              checked={viewMode === 'world'}
              onChange={() => setViewMode('world')}
            />{' '}
            World
          </label>
          <label>
            <input
              type="radio"
              name="view"
              checked={viewMode === 'technical'}
              onChange={() => setViewMode('technical')}
            />{' '}
            Technical
          </label>
        </fieldset>
        <label className="block text-xs">
          Speed
          <select
            data-testid="settings-speed"
            className="ml-2 border border-ink-3 bg-ink-0 px-2 py-1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as 1 | 2 | 4)}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
        <label className="block text-xs">
          Quantum
          <input
            data-testid="settings-quantum"
            className="ml-2 border border-ink-3 bg-ink-0 px-2 py-1"
            type="number"
            min={1}
            value={config.quantum}
            onChange={(e) => void configure({ quantum: Number(e.target.value) })}
          />
        </label>
        <label className="block text-xs">
          Total memory (Sandbox note: Assignment mode locks 1024)
          <input
            data-testid="settings-total-memory"
            className="ml-2 border border-ink-3 bg-ink-0 px-2 py-1"
            type="number"
            min={64}
            value={config.totalMemory}
            onChange={(e) => void configure({ totalMemory: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="panel p-4" data-testid="assumptions-panel">
        <h3 className="font-pixel text-[9px] text-gold-2">Assumptions (ASM-1 … ASM-12)</h3>
        <ul className="mt-3 space-y-2 text-xs">
          {assumptions.map((a) => (
            <li key={a.id} data-testid={`asm-${a.id}`} className="border-b border-ink-2/40 pb-2">
              <span className="text-gold-3">{a.id}</span> · default <code>{a.defaultValue}</code> ·{' '}
              <span className="text-ember-3">{a.status}</span>
              <p className="mt-1 text-stone-2">{a.rule}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
