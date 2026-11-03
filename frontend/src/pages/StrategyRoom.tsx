import { useState } from 'react';
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

export function StrategyRoom() {
  const runCompare = useSimStore((s) => s.runCompare);
  const compareResults = useSimStore((s) => s.compareResults);
  const strategyViews = useSimStore((s) => s.strategyViews);
  const [busy, setBusy] = useState(false);

  const onCompare = async () => {
    setBusy(true);
    try {
      await runCompare();
    } finally {
      setBusy(false);
    }
  };

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
            compare.run and per-policy snapshots at t=7 are engine-sourced. Results are
            workload-specific — no policy is declared universally best.
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="strategy-g2-panels">
          {strategyViews.map((v) => (
            <article key={v.policy} className="panel p-3" data-testid={`strategy-policy-${v.policy}`}>
              <h3 className="font-pixel text-[9px] text-gold-3">{v.policy}</h3>
              <p className="mt-1 text-[10px] text-stone-2">
                t={v.t} · NextFit@{v.nextFitOffset}
              </p>
              <ul className="mt-2 space-y-1 font-mono text-xs" data-testid={`g2-offsets-${v.policy}`}>
                {Object.entries(v.offsets).map(([name, off]) => (
                  <li key={name}>
                    {name} @ {off}
                  </li>
                ))}
              </ul>
              <ul className="mt-2 space-y-0.5 font-mono text-[10px] text-stone-2" data-testid={`g3-stats-${v.policy}`}>
                <li>free {v.statistics.free}</li>
                <li>largestFree {v.statistics.largestFree}</li>
                <li>extFrag {v.statistics.externalFragmentation}%</li>
                <li>dragonPower {v.statistics.dragonPower}</li>
              </ul>
            </article>
          ))}
        </div>
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
                    <td className="p-1">{r.policy}</td>
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
