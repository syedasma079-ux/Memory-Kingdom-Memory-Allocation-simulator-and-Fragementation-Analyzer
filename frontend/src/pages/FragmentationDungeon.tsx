import { useSimStore } from '../store/simStore';
import { DragonCanvas } from '../game/DragonCanvas';

const TIER_NAMES = ['Sleeping', 'Stirring', 'Awake', 'Enraged', 'Inferno'] as const;

export function FragmentationDungeon() {
  const snap = useSimStore((s) => s.getSnapshot());
  const events = useSimStore((s) => s.events);
  const st = snap?.arena.statistics;
  const freeBlocks = (snap?.arena.blocks ?? []).filter((b) => !b.allocated);
  const lastFail = [...events].reverse().find((e) => e.kind === 'alloc_failed');

  return (
    <section data-testid="page-dungeon" className="space-y-4">
      <header>
        <h2 className="font-pixel text-sm text-gold-2">Fragmentation Dungeon</h2>
        <p className="mt-1 text-xs text-stone-2">
          Dragon power equals engine externalFragmentation. Tiers and cracks come from the C engine.
        </p>
      </header>

      {/* Visual Animated Dragon */}
      <DragonCanvas
        tier={st?.dragonTier ?? 0}
        power={st?.dragonPower ?? 0}
        cracks={st?.cracks ?? 0}
      />

      {st ? (
        <div className="panel grid gap-3 p-4 md:grid-cols-3" data-testid="dungeon-stats">
          <Stat label="free" value={`${st.free} MB`} />
          <Stat label="largestFree" value={`${st.largestFree} MB`} />
          <Stat label="externalFragmentation" value={`${st.externalFragmentation}%`} />
          <Stat label="dragonPower" value={`${st.dragonPower}`} testId="dragon-power" />
          <Stat
            label="dragonTier"
            value={`${st.dragonTier} (${TIER_NAMES[st.dragonTier] ?? '?'})`}
            testId="dragon-tier"
          />
          <Stat label="cracks" value={`${st.cracks}`} />
          <Stat label="freeBlockCount" value={`${st.freeBlockCount}`} />
          <Stat label="largestFreePctOfTotal" value={`${st.largestFreePctOfTotal}%`} />
          <Stat label="failedAttempts" value={`${st.failedAttempts}`} />
          <Stat label="processesDelayed" value={`${st.processesDelayed}`} />
          <Stat label="searchSteps" value={`${st.searchSteps}`} />
          <Stat label="utilization" value={`${st.utilization}%`} />
        </div>
      ) : (
        <p className="text-sm text-stone-2">No statistics yet.</p>
      )}

      <div>
        <h3 className="font-pixel text-[9px] text-ember-3">Free chambers</h3>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="free-chambers">
          {freeBlocks.map((b, i) => (
            <div
              key={i}
              className="hatch-free border-2 border-grass-2 bg-grass-0 p-2 font-mono text-[10px]"
              style={{ minWidth: Math.max(48, b.size / 4) }}
            >
              @{b.offset} · {b.size} MB
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-3" data-testid="why-failed">
        <h3 className="font-pixel text-[9px] text-ember-2">Why did it fail?</h3>
        {lastFail ? (
          <p className="mt-2 font-mono text-xs">
            P{String(lastFail.data.pid)} requested {String(lastFail.data.size)} MB — reason{' '}
            <strong>{String(lastFail.data.reason)}</strong> (engine). Distinguishes INSUFFICIENT_TOTAL
            from NO_CONTIGUOUS_BLOCK.
          </p>
        ) : (
          <p className="mt-2 text-xs text-stone-2">No alloc_failed events yet.</p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div data-testid={testId}>
      <p className="label-chip">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
    </div>
  );
}
