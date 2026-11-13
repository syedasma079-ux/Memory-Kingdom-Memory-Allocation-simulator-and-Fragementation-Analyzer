import { useEffect, useRef } from 'react';
import { useSimStore } from '../store/simStore';
import { drawSprite } from '../game/spriteAtlas';
import { cn } from '../lib/cn';

function getAdventurerSprite(pid: number): string {
  if (pid === 0 || pid === 4) return 'adventurer_warrior_f1';
  if (pid === 1 || pid === 3 || pid === 5) return 'adventurer_mage_f1';
  if (pid === 2) return 'adventurer_rogue_f1';
  return 'adventurer_cleric_f1';
}

function AdventurerSpriteCanvas({ spriteId }: { spriteId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 32;
    canvas.height = 48;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 48);
    drawSprite(ctx, spriteId, 0, 0, 2);
  }, [spriteId]);

  return <canvas ref={canvasRef} className="pixelated" />;
}

export function ProcessTavern() {
  const snap = useSimStore((s) => s.getSnapshot());
  const loadAssignment = useSimStore((s) => s.loadAssignment);
  const loadRandom = useSimStore((s) => s.loadRandom);
  const openCustomWorkload = useSimStore((s) => s.openCustomWorkload);
  const reset = useSimStore((s) => s.reset);
  const procs = snap?.processes ?? [];

  return (
    <section data-testid="page-tavern" className="space-y-4">
      <header>
        <h2 className="font-pixel text-sm text-gold-2">Process Tavern</h2>
        <p className="mt-1 text-xs text-stone-2">
          Adventurers await the gate. Workload changes are validated by the engine/API.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" data-testid="tavern-load-assignment" onClick={() => void loadAssignment()}>
          Load assignment
        </button>
        <button
          type="button"
          className="btn border-gold-2 text-gold-2 hover:bg-gold-2/20"
          data-testid="tavern-create-dataset"
          onClick={openCustomWorkload}
        >
          Create Dataset
        </button>
        <button
          type="button"
          className="btn"
          data-testid="tavern-random"
          onClick={() => void loadRandom(1234, 8)}
        >
          Seeded random
        </button>
        <button type="button" className="btn" data-testid="tavern-reset" onClick={() => void reset()}>
          Reset
        </button>
      </div>

      {/* Adventurer Cards Grid */}
      {procs.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5" data-testid="adventurer-cards">
          {procs.map((p) => {
            const spriteId = getAdventurerSprite(p.pid);
            const isRunning = p.state === 'RUNNING';
            const isSuspended = p.state === 'SUSPENDED';
            const isTerminated = p.state === 'TERMINATED';

            return (
              <div
                key={p.pid}
                className={cn(
                  'panel flex flex-col items-center p-2 text-center transition-all',
                  isRunning && 'ring-2 ring-water-3 bg-water-0/40',
                  isSuspended && 'border-stone-2 bg-stone-0/40',
                  isTerminated && 'opacity-60 grayscale'
                )}
                data-testid={`adventurer-card-${p.pid}`}
              >
                <div className="flex h-14 w-12 items-center justify-center rounded border border-ink-3 bg-ink-0">
                  <AdventurerSpriteCanvas spriteId={spriteId} />
                </div>
                <p className="mt-1 font-pixel text-[9px] text-gold-2">{p.name}</p>
                <span
                  className={cn(
                    'mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-mono',
                    p.state === 'RUNNING' && 'bg-water-2 text-water-3',
                    p.state === 'READY' && 'bg-grass-2 text-grass-3',
                    p.state === 'WAITING_FOR_MEMORY' && 'bg-gold-1 text-gold-3',
                    p.state === 'SUSPENDED' && 'bg-stone-2 text-stone-3',
                    p.state === 'TERMINATED' && 'bg-ink-3 text-stone-2',
                    p.state === 'NOT_ARRIVED' && 'bg-ink-1 text-stone-3'
                  )}
                >
                  {p.state}
                </span>
                <p className="mt-1 font-mono text-[9px] text-stone-3">
                  {p.memMb} MB · Q{p.queueLevel}
                </p>
                <p className="font-mono text-[9px] text-stone-3">
                  Rem: {p.remaining}/{p.cpuBurst}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs" data-testid="process-table">
          <thead>
            <tr className="border-b border-ink-3 text-stone-2">
              <th className="p-1">PID</th>
              <th className="p-1">Name</th>
              <th className="p-1">Arrival</th>
              <th className="p-1">Pri</th>
              <th className="p-1">Burst</th>
              <th className="p-1">Remain</th>
              <th className="p-1">Mem</th>
              <th className="p-1">Offset</th>
              <th className="p-1">State</th>
              <th className="p-1">Q</th>
            </tr>
          </thead>
          <tbody>
            {(snap?.processes ?? []).map((p) => (
              <tr key={p.pid} className="border-b border-ink-2/40" data-testid={`process-row-${p.pid}`}>
                <td className="p-1">{p.pid}</td>
                <td className="p-1">{p.name}</td>
                <td className="p-1">{p.arrival}</td>
                <td className="p-1">{p.priority}</td>
                <td className="p-1">{p.cpuBurst}</td>
                <td className="p-1">{p.remaining}</td>
                <td className="p-1">{p.memMb}</td>
                <td className="p-1">{p.offset}</td>
                <td className="p-1">{p.state}</td>
                <td className="p-1">{p.queueLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
