import { useMemo, useState } from 'react';
import { QUESTS } from '../quests/definitions';
import { Q2_SOLUTION, Q6_SOLUTION } from '../quests/solutions';
import { useSimStore } from '../store/simStore';

export function QuestBoard() {
  const sendCommand = useSimStore((s) => s.sendCommand);
  const events = useSimStore((s) => s.events);
  const snap = useSimStore((s) => s.getSnapshot());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [baselineExtFrag, setBaselineExtFrag] = useState<number | undefined>();
  const [prediction, setPrediction] = useState(0);
  const [score, setScore] = useState(0);

  const active = QUESTS.find((q) => q.id === activeId) ?? null;

  const complete = useMemo(() => {
    if (!active) return false;
    return active.isComplete({ events, snapshot: snap, baselineExtFrag, flags });
  }, [active, events, snap, baselineExtFrag, flags]);

  const startQuest = async (id: string) => {
    setActiveId(id);
    setHintIndex(0);
    setFlags({});
    if (id === 'q2') {
      for (const step of Q2_SOLUTION.slice(0, 1)) {
        await sendCommand(step);
      }
    }
    if (id === 'q6') {
      await sendCommand(Q6_SOLUTION[0]);
      const s = useSimStore.getState().getSnapshot();
      setBaselineExtFrag(s?.arena.statistics.externalFragmentation);
    }
  };

  const revealHint = () => {
    if (!active) return;
    setHintIndex((i) => Math.min(active.hints.length, i + 1));
    setScore((s) => s - 5);
  };

  const runSandboxAlloc = async (size: number) => {
    try {
      const data = (await sendCommand({ cmd: 'arena.alloc', size, pid: 77 })) as {
        offset: number;
      };
      if (size === 100) setFlags((f) => ({ ...f, alloc100: true }));
      if (activeId === 'q3' && data.offset === prediction) {
        setFlags((f) => ({ ...f, predictionCorrect: true }));
        setScore((s) => s + 20);
      }
      if (activeId === 'q5') {
        setFlags((f) => {
          if (f.oneNextFitAlloc) return { ...f, twoNextFitAllocs: true };
          return { ...f, oneNextFitAlloc: true };
        });
      }
    } catch {
      setFlags((f) => ({ ...f, allocFailed: true }));
    }
  };

  const applyQ2FreeAndAlloc = async () => {
    for (const step of Q2_SOLUTION.slice(1)) {
      await sendCommand(step);
    }
    setFlags((f) => ({ ...f, q2Solved: true }));
  };

  const applyQ6Frees = async () => {
    for (const step of Q6_SOLUTION.slice(1)) {
      await sendCommand(step);
    }
    const s = useSimStore.getState().getSnapshot();
    if (
      baselineExtFrag !== undefined &&
      s &&
      baselineExtFrag - s.arena.statistics.externalFragmentation >= 10
    ) {
      setFlags((f) => ({ ...f, fragDropped: true }));
    }
  };

  return (
    <section data-testid="page-quests" className="space-y-4">
      <header>
        <h2 className="font-pixel text-sm text-gold-2">Quest and Challenge Board</h2>
        <p className="mt-1 text-xs text-stone-2">
          Predicates read engine events and snapshots only. Score: {score}
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        {QUESTS.map((q) => (
          <article key={q.id} className="panel p-3" data-testid={`quest-card-${q.id}`}>
            <h3 className="font-pixel text-[9px] text-gold-3">
              {q.title} · {q.difficulty}
            </h3>
            <p className="mt-2 text-xs">{q.objective}</p>
            <button
              type="button"
              className="btn mt-3"
              data-testid={`quest-start-${q.id}`}
              onClick={() => void startQuest(q.id)}
            >
              Start
            </button>
          </article>
        ))}
      </div>

      {active && (
        <div className="panel space-y-3 p-4" data-testid="quest-active">
          <h3 className="font-pixel text-[10px] text-magic-1">{active.title}</h3>
          <p className="text-xs">{active.objective}</p>
          <p className="text-xs text-stone-2">{active.explanation}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" data-testid="quest-hint" onClick={revealHint}>
              Hint (−5)
            </button>
            {active.id === 'q1' && (
              <button type="button" className="btn" data-testid="quest-q1-alloc" onClick={() => void runSandboxAlloc(100)}>
                Alloc 100
              </button>
            )}
            {active.id === 'q2' && (
              <button type="button" className="btn" data-testid="quest-q2-solve" onClick={() => void applyQ2FreeAndAlloc()}>
                Free neighbor + alloc 200
              </button>
            )}
            {active.id === 'q3' && (
              <>
                <label className="text-xs">
                  Predict offset
                  <input
                    data-testid="quest-predict"
                    className="ml-2 border border-ink-3 bg-ink-0 px-2 py-1"
                    type="number"
                    value={prediction}
                    onChange={(e) => setPrediction(Number(e.target.value))}
                  />
                </label>
                <button type="button" className="btn" onClick={() => void runSandboxAlloc(64)}>
                  Alloc 64
                </button>
              </>
            )}
            {active.id === 'q4' && (
              <button type="button" className="btn" onClick={() => void runSandboxAlloc(1000)}>
                Attempt huge alloc
              </button>
            )}
            {active.id === 'q5' && (
              <button type="button" className="btn" onClick={() => void runSandboxAlloc(64)}>
                Next Fit alloc
              </button>
            )}
            {active.id === 'q6' && (
              <button type="button" className="btn" data-testid="quest-q6-solve" onClick={() => void applyQ6Frees()}>
                Free fragments
              </button>
            )}
          </div>
          <ul className="text-xs text-stone-2">
            {active.hints.slice(0, hintIndex).map((h, i) => (
              <li key={i}>Hint {i + 1}: {h}</li>
            ))}
          </ul>
          {complete && (
            <p className="text-sm text-grass-3" data-testid="quest-complete">
              Quest complete.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
