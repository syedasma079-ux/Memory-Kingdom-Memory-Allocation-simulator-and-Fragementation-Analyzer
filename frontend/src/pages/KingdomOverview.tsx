import { useState } from 'react';
import { useSimStore } from '../store/simStore';
import { LandingScene } from '../components/LandingScene';

export function KingdomOverview() {
  const snap = useSimStore((s) => s.getSnapshot());
  const config = useSimStore((s) => s.config);
  const setLocation = useSimStore((s) => s.setLocation);
  const loadAssignment = useSimStore((s) => s.loadAssignment);
  const openCustomWorkload = useSimStore((s) => s.openCustomWorkload);
  const [showAbout, setShowAbout] = useState(false);

  const procs = snap?.processes ?? [];
  const running = procs.filter((p) => p.state === 'RUNNING').length;
  const ready = procs.filter((p) => p.state === 'READY' || p.state === 'SUSPENDED').length;

  return (
    <section data-testid="page-overview" className="space-y-6">
      {/* 16-Bit SNES Cinematic Landing Scene */}
      <LandingScene
        onEnter={() => setLocation('arena')}
        onHowToPlay={() => setLocation('settings')}
        onChallenges={() => setLocation('quests')}
        onAbout={() => setShowAbout(true)}
      />

      <header className="space-y-3">
        <h1 className="font-pixel text-xl text-gold-2 md:text-2xl">MEMORY KINGDOM</h1>
        <p className="text-sm text-stone-2">THE ART OF MANAGING THE REALM</p>
        <p className="max-w-2xl text-sm text-stone-3">
          Every process needs a home. Every memory block tells a story. The C engine is the sole
          source of truth — this court only displays what the realm reports.
        </p>
      </header>

      <div className="panel grid gap-3 p-4 md:grid-cols-4">
        <div>
          <p className="label-chip">Time</p>
          <p className="mt-2 font-mono text-lg" data-testid="overview-t">
            t = {snap?.t ?? 0}
          </p>
        </div>
        <div>
          <p className="label-chip">Policy</p>
          <p className="mt-2 font-mono text-lg" data-testid="overview-policy">
            {config.policy}
          </p>
        </div>
        <div>
          <p className="label-chip">Running</p>
          <p className="mt-2 font-mono text-lg">{running}</p>
        </div>
        <div>
          <p className="label-chip">In queues</p>
          <p className="mt-2 font-mono text-lg">{ready}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" data-testid="overview-enter-arena" onClick={() => setLocation('arena')}>
          Enter Memory Arena
        </button>
        <button
          type="button"
          className="btn"
          data-testid="overview-load-assignment"
          onClick={() => void loadAssignment()}
        >
          Load Assignment Dataset
        </button>
        <button
          type="button"
          className="btn border-gold-2 text-gold-2 hover:bg-gold-2/20"
          data-testid="overview-create-dataset"
          onClick={openCustomWorkload}
        >
          Create Dataset
        </button>
        <button type="button" className="btn" data-testid="overview-how" onClick={() => setLocation('settings')}>
          How to Play / Assumptions
        </button>
        <button type="button" className="btn" data-testid="overview-challenges" onClick={() => setLocation('quests')}>
          Memory Challenges
        </button>
        <button type="button" className="btn" data-testid="overview-about" onClick={() => setShowAbout(!showAbout)}>
          About the Realm
        </button>
      </div>

      {showAbout && (
        <div className="panel p-4 space-y-2 border-gold-2" data-testid="overview-about-modal">
          <h3 className="font-pixel text-xs text-gold-2">About MEMORY KINGDOM</h3>
          <p className="text-xs text-stone-3 leading-relaxed">
            MEMORY KINGDOM is a full-stack Operating Systems memory allocation simulator and
            fragmentation analyzer. The 1024 MB arena represents an ancient realm where incoming
            processes are brave adventurers seeking plots of land. Four allocation guilds govern
            where they settle: Swift Rangers (First Fit), Wandering Knights (Next Fit), Precision
            Architects (Best Fit), and Giant Keepers (Worst Fit).
          </p>
          <p className="text-xs text-stone-3 leading-relaxed">
            As adventurers finish their quests and abandon settlements, disjointed free holes create
            the dreaded Dragon of Fragmentation. All allocations, pointer updates, and statistics
            originate exclusively from the native C engine.
          </p>
        </div>
      )}
    </section>
  );
}
