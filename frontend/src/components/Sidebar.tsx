import { LOCATIONS, useSimStore } from '../store/simStore';
import { cn } from '../lib/cn';

export function Sidebar() {
  const location = useSimStore((s) => s.location);
  const setLocation = useSimStore((s) => s.setLocation);

  return (
    <nav
      aria-label="Kingdom locations"
      className="flex w-64 shrink-0 flex-col gap-1 border-r-2 border-ink-3 bg-ink-0/80 p-3"
      data-testid="sidebar"
    >
      <div className="mb-3 border-b border-ink-3 pb-3">
        <p className="font-pixel text-[10px] leading-relaxed text-gold-2">MEMORY KINGDOM</p>
        <p className="mt-1 text-[10px] text-stone-2">Map &amp; sidebar</p>
      </div>
      {LOCATIONS.map((loc) => (
        <button
          key={loc.id}
          type="button"
          data-testid={`nav-${loc.id}`}
          aria-current={location === loc.id ? 'page' : undefined}
          className={cn(
            'w-full border-2 px-2 py-2 text-left text-[11px] transition',
            location === loc.id
              ? 'border-gold-2 bg-ink-2 text-gold-3'
              : 'border-transparent bg-transparent text-stone-3 hover:border-ink-3 hover:bg-ink-1'
          )}
          onClick={() => setLocation(loc.id)}
        >
          {loc.label}
        </button>
      ))}
    </nav>
  );
}
