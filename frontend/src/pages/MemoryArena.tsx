import { RealmMap, SandboxControls, TechnicalView } from '../memory-arena/ArenaViews';
import { useSimStore } from '../store/simStore';

export function MemoryArena() {
  const viewMode = useSimStore((s) => s.viewMode);
  const setViewMode = useSimStore((s) => s.setViewMode);
  const snap = useSimStore((s) => s.getSnapshot());

  return (
    <section data-testid="page-arena" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-pixel text-sm text-gold-2">Memory Arena</h2>
          <p className="mt-1 text-xs text-stone-2">
            WORLD and TECHNICAL render the same engine snapshot (t={snap?.t ?? 0}).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn"
            data-testid="arena-mode-world"
            aria-pressed={viewMode === 'world'}
            onClick={() => setViewMode('world')}
          >
            WORLD
          </button>
          <button
            type="button"
            className="btn"
            data-testid="arena-mode-technical"
            aria-pressed={viewMode === 'technical'}
            onClick={() => setViewMode('technical')}
          >
            TECHNICAL
          </button>
        </div>
      </header>

      {viewMode === 'world' ? <RealmMap /> : <TechnicalView />}
      <SandboxControls />
    </section>
  );
}
