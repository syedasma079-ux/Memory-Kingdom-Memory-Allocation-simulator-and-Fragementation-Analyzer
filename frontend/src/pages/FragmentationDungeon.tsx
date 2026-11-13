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
          <Stat
            label="internalFragmentation"
            value={`${st.internalFragmentation ?? 0} MB`}
            testId="internal-fragmentation"
          />
          <Stat
            label="allocationEfficiency"
            value={`${(st.allocationEfficiency ?? 100).toFixed(1)}%`}
            testId="allocation-efficiency"
          />
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

      {/* Side-by-side Fragmentation Anatomy Comparison */}
      <div className="grid gap-3 md:grid-cols-2" data-testid="fragmentation-comparison">
        <div className="panel border border-ember-2 bg-ink-1/80 p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-pixel text-[10px] text-ember-3">External Fragmentation</h3>
            <span className="rounded bg-ember-0 px-2 py-0.5 font-mono text-xs text-ember-3">
              {st?.externalFragmentation ?? 0}%
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-2">
            Free memory shattered into non-contiguous holes. Even if total free memory is sufficient,
            no single hole can fulfill larger allocation requests. This feeds the Dragon of Fragmentation.
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-stone-3">
            <span>Free Chambers: <strong className="text-stone-1">{st?.freeBlockCount ?? 0}</strong></span>
            <span>·</span>
            <span>Largest Hole: <strong className="text-stone-1">{st?.largestFree ?? 0} MB</strong></span>
          </div>
        </div>

        <div className="panel border border-gold-2 bg-ink-1/80 p-3">
          <div className="flex items-center justify-between">
            <h3 className="font-pixel text-[10px] text-gold-2">Internal Fragmentation</h3>
            <span className="rounded bg-gold-0 px-2 py-0.5 font-mono text-xs text-gold-3" data-testid="internal-frag-pill">
              {st?.internalFragmentation ?? 0} MB
            </span>
          </div>
          <p className="mt-1 text-xs text-stone-2">
            Unused memory trapped inside allocated blocks. In Memory Kingdom, the C allocator performs exact-size block splitting, leaving 0 MB internal fragmentation and maximizing allocation efficiency.
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-stone-3">
            <span>Efficiency: <strong className="text-grass-3" data-testid="efficiency-stat">{(st?.allocationEfficiency ?? 100).toFixed(1)}%</strong></span>
            <span>·</span>
            <span>Wasted in Blocks: <strong className="text-stone-1">{st?.internalFragmentation ?? 0} MB</strong></span>
          </div>
        </div>
      </div>

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
