import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useSimStore } from '../store/simStore';
import { cn } from '../lib/cn';
import type { PolicyMidRunView } from '../types/engine';

const STEP_LABELS = [
  { step: 0, label: 'Baseline (t=6)', sub: 'Initial G1 Layout' },
  { step: 1, label: 'Admit P6', sub: '108 MB' },
  { step: 2, label: 'Admit P7', sub: '256 MB' },
  { step: 3, label: 'Admit P8', sub: '80 MB' }
];

const POLICY_TITLES: Record<string, string> = {
  first_fit: 'First Fit',
  next_fit: 'Next Fit',
  best_fit: 'Best Fit',
  worst_fit: 'Worst Fit'
};

export function StrategyRoom() {
  const runCompare = useSimStore((s) => s.runCompare);
  const compareResults = useSimStore((s) => s.compareResults);
  const strategyViews = useSimStore((s) => s.strategyViews);
  const [busy, setBusy] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const onCompare = async () => {
    setBusy(true);
    setIsPlaying(false);
    try {
      await runCompare();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= 3) {
          setIsPlaying(false);
          return 3;
        }
        return prev + 1;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const chartData =
    compareResults?.map((r) => ({
      policy: String(r.policy),
      utilization: r.utilization,
      externalFragmentation: r.externalFragmentation,
      failedAttempts: r.failedAttempts,
      totalSearchSteps: r.totalSearchSteps,
      avgMemoryWait: r.avgMemoryWait
    })) ?? [];

  return (
    <section data-testid="page-strategy" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-pixel text-sm text-gold-2">Royal Strategy Room</h2>
          <p className="mt-1 max-w-2xl text-xs text-stone-2">
            Side-by-side comparison of all 4 allocation algorithms on the assignment workload.
            Layouts, trace steps, offsets, and fragmentation statistics are real and engine-sourced.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          data-testid="strategy-run-compare"
          disabled={busy}
          onClick={() => void onCompare()}
        >
          {busy ? 'Comparing…' : 'Run Comparison'}
        </button>
      </header>

      {strategyViews && (
        <>
          {/* Step-by-step Interactive Stepper Toolbar (if step data present) */}
          {strategyViews.some((v) => v.steps && v.steps.length > 0) && (
            <div
              className="panel p-3 bg-ink-1 flex flex-wrap items-center justify-between gap-3"
              data-testid="strategy-step-controls"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-pixel text-[10px] text-gold-2">Trace Step:</span>
                <div className="flex flex-wrap gap-1.5">
                  {STEP_LABELS.map((sl) => (
                    <button
                      key={sl.step}
                      type="button"
                      className={cn(
                        'px-2 py-1 text-[10px] font-mono border transition-all cursor-pointer',
                        currentStep === sl.step
                          ? 'border-gold-2 bg-gold-2/20 text-gold-3 font-bold ring-1 ring-gold-2'
                          : 'border-ink-3 bg-ink-2 text-stone-2 hover:bg-ink-3'
                      )}
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStep(sl.step);
                      }}
                      data-testid={`strategy-step-pill-${sl.step}`}
                    >
                      {sl.label} <span className="opacity-75">({sl.sub})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn py-1 px-2.5 text-[11px]"
                  data-testid="strategy-reset-step"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep(0);
                  }}
                  disabled={currentStep === 0}
                >
                  ⏮ Reset
                </button>
                <button
                  type="button"
                  className="btn py-1 px-2.5 text-[11px]"
                  data-testid="strategy-prev-step"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep((s) => Math.max(0, s - 1));
                  }}
                  disabled={currentStep === 0}
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  className="btn py-1 px-3 text-[11px]"
                  data-testid="strategy-play-pause"
                  onClick={() => setIsPlaying((p) => !p)}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                  type="button"
                  className="btn py-1 px-2.5 text-[11px]"
                  data-testid="strategy-next-step"
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStep((s) => Math.min(3, s + 1));
                  }}
                  disabled={currentStep === 3}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}

          {/* 4 Algorithms Side by Side */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="strategy-g2-panels">
            {strategyViews.map((v) => (
              <PolicyPanel
                key={v.policy}
                view={v}
                currentStep={currentStep}
              />
            ))}
          </div>
        </>
      )}

      {compareResults && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[11px]" data-testid="strategy-table">
              <thead>
                <tr className="border-b border-ink-3 text-stone-2">
                  <th className="p-1">policy</th>
                  <th className="p-1">ok</th>
                  <th className="p-1">fail</th>
                  <th className="p-1">delayed</th>
                  <th className="p-1">free</th>
                  <th className="p-1">largest</th>
                  <th className="p-1">freeBlocks</th>
                  <th className="p-1">util%</th>
                  <th className="p-1">extFrag%</th>
                  <th className="p-1">steps</th>
                  <th className="p-1">wait</th>
                  <th className="p-1">turnaround</th>
                  <th className="p-1">makespan</th>
                </tr>
              </thead>
              <tbody>
                {compareResults.map((r) => (
                  <tr key={String(r.policy)} className="border-b border-ink-2/40">
                    <td className="p-1 font-bold text-gold-3">{r.policy}</td>
                    <td className="p-1">{r.successfulAttempts}</td>
                    <td className="p-1">{r.failedAttempts}</td>
                    <td className="p-1">{r.processesDelayed}</td>
                    <td className="p-1">{r.totalFree}</td>
                    <td className="p-1">{r.largestFree}</td>
                    <td className="p-1">{r.freeBlockCount}</td>
                    <td className="p-1">{r.utilization}</td>
                    <td className="p-1">{r.externalFragmentation}</td>
                    <td className="p-1">{r.totalSearchSteps}</td>
                    <td className="p-1">{r.avgMemoryWait}</td>
                    <td className="p-1">{r.avgTurnaround}</td>
                    <td className="p-1">{r.makespan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MetricWinners results={compareResults} />
          <div className="h-64 w-full" data-testid="strategy-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3a2c55" />
                <XAxis dataKey="policy" stroke="#8c8996" fontSize={10} />
                <YAxis stroke="#8c8996" fontSize={10} />
                <Tooltip />
                <Legend />
                <Bar dataKey="utilization" fill="#3b8fc4" name="utilization %" />
                <Bar dataKey="externalFragmentation" fill="#d4483b" name="extFrag %" />
                <Bar dataKey="totalSearchSteps" fill="#f2c14e" name="search steps" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}

function PolicyPanel({
  view,
  currentStep
}: {
  view: PolicyMidRunView;
  currentStep: number;
}) {
  const stepData = view.steps && view.steps[currentStep] ? view.steps[currentStep] : null;
  const blocks = stepData ? stepData.blocks : view.blocks;
  const stats = stepData ? stepData.statistics : view.statistics;
  const nextFit = stepData ? stepData.nextFitOffset : view.nextFitOffset;
  const totalMem = stats?.total || 1024;

  return (
    <article className="panel p-3 flex flex-col justify-between" data-testid={`strategy-policy-${view.policy}`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-pixel text-[9px] text-gold-3">
            {view.policy}
          </h3>
          <span className="text-[10px] text-stone-3 font-mono">
            {POLICY_TITLES[view.policy]}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-stone-2">
          t={view.t} · NextFit@{nextFit}
        </p>

        {/* Proportional Memory Layout Bar */}
        <div className="mt-2.5 space-y-1">
          <div className="flex items-center justify-between text-[9px] text-stone-3 font-mono">
            <span>Layout ({totalMem} MB)</span>
            {view.policy === 'next_fit' && (
              <span className="text-gold-2">NF Ptr: {nextFit}</span>
            )}
          </div>
          <div
            className="relative h-8 w-full border border-ink-3 bg-ink-0 overflow-hidden"
            data-testid={`strategy-layout-${view.policy}`}
            title={`${POLICY_TITLES[view.policy]} ${totalMem}MB memory layout`}
          >
            {blocks.map((b, i) => {
              const isNew =
                stepData &&
                stepData.step > 0 &&
                b.allocated &&
                b.offset === stepData.allocatedOffset;
              const leftPct = (b.offset / totalMem) * 100;
              const widthPct = (b.size / totalMem) * 100;
              return (
                <div
                  key={`${b.offset}-${b.size}-${i}`}
                  className={cn(
                    'absolute top-0 h-full border-r border-ink-2/60 text-[8px] flex items-center justify-center font-mono select-none overflow-hidden',
                    b.allocated
                      ? 'bg-water-1/80 hatch-alloc text-water-3'
                      : 'bg-grass-1/80 hatch-free text-grass-3',
                    isNew && 'ring-2 ring-gold-2 ring-inset bg-gold-2/40 text-gold-3 font-bold z-10'
                  )}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`[${b.offset}..${b.offset + b.size}] size: ${b.size}MB (${b.allocated ? (b.pid >= 0 ? `PID ${b.pid}` : 'Allocated') : 'Free'})`}
                >
                  {widthPct > 5 && (
                    <span className="truncate px-0.5">
                      {b.allocated ? (b.pid >= 0 ? `P${b.pid}` : 'A') : `${b.size}M`}
                    </span>
                  )}
                </div>
              );
            })}
            {/* NextFit marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-gold-2 z-20"
              style={{ left: `${(nextFit / totalMem) * 100}%` }}
              title={`NextFit pointer: offset ${nextFit}`}
            />
          </div>
          <div className="flex justify-between text-[8px] text-stone-3 font-mono px-0.5">
            <span>0</span>
            <span>{Math.round(totalMem / 2)}</span>
            <span>{totalMem}</span>
          </div>
        </div>

        {/* Step-by-Step Allocation Trace Box */}
        {stepData ? (
          <div className="mt-2.5 rounded border border-ink-3 bg-ink-0/60 p-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="font-pixel text-[8px] text-gold-2 uppercase">
                {stepData.step === 0
                  ? 'Baseline (t=6)'
                  : `${stepData.processName} (${stepData.requestSize} MB)`}
              </span>
              {stepData.step > 0 && stepData.allocatedOffset !== null ? (
                <span className="label-chip border-gold-2 text-gold-3 font-bold">
                  Offset @ {stepData.allocatedOffset}
                </span>
              ) : (
                <span className="label-chip text-stone-2">G1 Layout</span>
              )}
            </div>

            {/* Free blocks examined */}
            {stepData.step > 0 && (
              <div className="space-y-0.5">
                <div className="text-[9px] uppercase tracking-wider text-stone-3">
                  Free blocks examined:
                </div>
                <div className="flex flex-wrap gap-1">
                  {stepData.blocksExamined.map((be) => (
                    <span
                      key={be.offset}
                      className={cn(
                        'px-1.5 py-0.5 font-mono text-[9px] border rounded-xs',
                        be.verdict === 'accepted'
                          ? 'border-gold-2 bg-gold-2/20 text-gold-3 font-bold ring-1 ring-gold-2'
                          : be.verdict === 'rejected'
                          ? 'border-ember-2/50 bg-ember-0/30 text-ember-3 line-through opacity-70'
                          : 'border-stone-1/40 bg-ink-1 text-stone-3 opacity-60'
                      )}
                      title={`Block @${be.offset} (${be.size}MB): ${be.verdict}`}
                    >
                      @{be.offset} ({be.size}M){' '}
                      {be.verdict === 'accepted' ? '✓' : be.verdict === 'rejected' ? '✗' : '⊘'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Algorithm selection rationale */}
            <div className="rounded bg-ink-2/80 p-1.5 border border-ink-3 text-[10px] text-stone-2 italic leading-tight">
              <strong className="text-gold-2 not-italic">Decision: </strong>
              {stepData.reason ?? 'Baseline snapshot prior to admissions.'}
            </div>

            <div className="flex items-center justify-between text-[10px] text-stone-3 pt-0.5 border-t border-ink-2/40">
              <span>Remaining Free:</span>
              <span className="font-mono text-stone-1 font-bold">{stats.free} MB</span>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 rounded border border-ink-3 bg-ink-0/60 p-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-1">
              <span className="font-pixel text-[8px] text-gold-2 uppercase">Custom Simulation</span>
              <span className="label-chip border-gold-2 text-gold-3 font-mono font-bold">
                t = {view.t}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] text-stone-2 font-mono">
              <div>Free: <span className="text-stone-1 font-bold">{stats.free} MB</span></div>
              <div>Util: <span className="text-water-3 font-bold">{(stats.utilization ?? 0).toFixed(1)}%</span></div>
              <div>Frag: <span className="text-ember-3 font-bold">{(stats.externalFragmentation ?? 0).toFixed(1)}%</span></div>
              <div>Steps: <span className="text-gold-3 font-bold">{stats.searchSteps}</span></div>
            </div>
          </div>
        )}

        {/* Search Steps & Fragmentation Statistics */}
        <div
          className="mt-2.5 grid grid-cols-2 gap-1 rounded border border-ink-3 bg-ink-2/40 p-2 font-mono text-[10px]"
          data-testid={`g3-stats-${view.policy}`}
        >
          <div>
            <span className="text-stone-3">Search steps: </span>
            <span className="text-gold-3 font-bold">{stats.searchSteps}</span>
          </div>
          <div>
            <span className="text-stone-3">Ext frag: </span>
            <span className="text-water-3 font-bold">{stats.externalFragmentation}%</span>
          </div>
          <div>
            <span className="text-stone-3">Largest free: </span>
            <span className="text-stone-1">{stats.largestFree} MB</span>
          </div>
          <div>
            <span className="text-stone-3">Dragon power: </span>
            <span className="text-ember-3 font-bold">{stats.dragonPower}</span>
          </div>
          <ul className="sr-only">
            <li>free {stats.free}</li>
            <li>largestFree {stats.largestFree}</li>
            <li>extFrag {stats.externalFragmentation}%</li>
            <li>dragonPower {stats.dragonPower}</li>
          </ul>
        </div>
      </div>

      {/* Golden Offsets Reference */}
      <div className="mt-2.5 pt-2 border-t border-ink-3/60">
        <span className="text-[9px] uppercase tracking-wider text-stone-3">Offsets (P6-P8):</span>
        <ul className="mt-1 flex flex-wrap gap-2 font-mono text-xs" data-testid={`g2-offsets-${view.policy}`}>
          {Object.entries(view.offsets).map(([name, off]) => (
            <li key={name} className="text-stone-2">
              <span className="text-gold-3 font-bold">{name}</span> @ {off}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function MetricWinners({
  results
}: {
  results: NonNullable<ReturnType<typeof useSimStore.getState>['compareResults']>;
}) {
  const metrics: { key: keyof (typeof results)[0]; label: string; lowerBetter: boolean }[] = [
    { key: 'failedAttempts', label: 'failures', lowerBetter: true },
    { key: 'totalSearchSteps', label: 'search steps', lowerBetter: true },
    { key: 'avgMemoryWait', label: 'memory wait', lowerBetter: true },
    { key: 'externalFragmentation', label: 'ext frag', lowerBetter: true },
    { key: 'utilization', label: 'utilization', lowerBetter: false },
    { key: 'makespan', label: 'makespan', lowerBetter: true }
  ];

  return (
    <div className="panel p-3" data-testid="strategy-winners">
      <h3 className="font-pixel text-[9px] text-gold-2">Winners per metric</h3>
      <ul className="mt-2 space-y-1 text-xs">
        {metrics.map((m) => {
          const values = results.map((r) => Number(r[m.key]));
          const best = m.lowerBetter ? Math.min(...values) : Math.max(...values);
          const winners = results.filter((r) => Number(r[m.key]) === best).map((r) => r.policy);
          const tie = winners.length > 1;
          return (
            <li key={m.label}>
              {m.label}: {winners.join(', ')} {tie ? '(tie)' : ''} = {best}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
