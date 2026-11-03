import type { Policy } from '../types/engine';
import { useSimStore } from '../store/simStore';
import { cn } from '../lib/cn';

const GUILDS: {
  policy: Policy;
  name: string;
  theme: string;
  explanation: string;
  search: string;
  advantages: string;
  disadvantages: string;
}[] = [
  {
    policy: 'first_fit',
    name: 'Swift Rangers',
    theme: 'forest',
    explanation: 'First Fit takes the first free territory large enough.',
    search: 'Walks from the list head; stops at the first fit.',
    advantages: 'Fast; simple; low overhead.',
    disadvantages: 'Can leave awkward leftovers near the head.'
  },
  {
    policy: 'best_fit',
    name: 'Precision Architects',
    theme: 'golden',
    explanation: 'Best Fit chooses the smallest free block that still fits.',
    search: 'Examines all free blocks; ties go to lowest offset (ASM-10).',
    advantages: 'Conserves larger holes.',
    disadvantages: 'More search steps; can create tiny unusable scraps.'
  },
  {
    policy: 'next_fit',
    name: 'Wandering Knights',
    theme: 'roads',
    explanation: 'Next Fit resumes from the persistent compass pointer.',
    search: 'Circular walk from the Next Fit marker; pointer persists (ASM-8).',
    advantages: 'Spreads allocations across the realm.',
    disadvantages: 'May skip earlier suitable holes.'
  },
  {
    policy: 'worst_fit',
    name: 'Giant Keepers',
    theme: 'stone',
    explanation: 'Worst Fit claims the largest free territory.',
    search: 'Examines all free blocks; ties go to lowest offset (ASM-10).',
    advantages: 'Leaves larger remainders after splits.',
    disadvantages: 'Can shatter the biggest open lands quickly.'
  }
];

export function AlgorithmGuild() {
  const config = useSimStore((s) => s.config);
  const snap = useSimStore((s) => s.getSnapshot());
  const setPolicy = useSimStore((s) => s.setPolicy);
  const locked = (snap?.t ?? 0) > 0;
  const st = snap?.arena.statistics;

  return (
    <section data-testid="page-guild" className="space-y-4">
      <header>
        <h2 className="font-pixel text-sm text-gold-2">Algorithm Guild</h2>
        <p className="mt-1 text-xs text-stone-2">
          Select a guild before the scenario advances. After tick 0, Restart is required to change policy.
        </p>
        {locked && (
          <p className="mt-2 text-xs text-ember-3" data-testid="guild-locked">
            Policy locked (t &gt; 0). Restart to reselect.
          </p>
        )}
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {GUILDS.map((g) => (
          <article
            key={g.policy}
            className={cn(
              'panel p-3',
              config.policy === g.policy && 'border-gold-2'
            )}
            data-testid={`guild-card-${g.policy}`}
          >
            <h3 className="font-pixel text-[10px] text-gold-3">{g.name}</h3>
            <p className="mt-1 text-[10px] uppercase text-stone-2">
              {g.policy.replace('_', ' ')} · {g.theme}
            </p>
            <p className="mt-2 text-xs">{g.explanation}</p>
            <p className="mt-1 text-xs text-stone-2">Search: {g.search}</p>
            <p className="mt-1 text-xs text-grass-3">+ {g.advantages}</p>
            <p className="mt-1 text-xs text-ember-3">− {g.disadvantages}</p>
            {st && config.policy === g.policy && (
              <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-stone-2" data-testid="guild-live-stats">
                <li>searchSteps {st.searchSteps}</li>
                <li>failedAttempts {st.failedAttempts}</li>
                <li>utilization {st.utilization}%</li>
                <li>extFrag {st.externalFragmentation}%</li>
              </ul>
            )}
            <button
              type="button"
              className="btn mt-3"
              data-testid={`guild-select-${g.policy}`}
              disabled={locked && config.policy !== g.policy}
              onClick={() => void setPolicy(g.policy)}
            >
              {config.policy === g.policy ? 'Selected' : 'Select'}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
