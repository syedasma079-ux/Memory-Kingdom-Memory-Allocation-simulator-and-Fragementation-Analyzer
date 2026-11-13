import { useEffect, useState } from 'react';
import { useSimStore } from '../store/simStore';
import type { Job } from '../types/engine';
import { cn } from '../lib/cn';

interface ProcessDraft {
  arrival: number | string;
  cpuBurst: number | string;
  memMb: number | string;
  priority: 1 | 2 | 3;
}

const DEFAULT_DRAFTS: ProcessDraft[] = [
  { arrival: 0, cpuBurst: 2, memMb: 128, priority: 1 },
  { arrival: 0, cpuBurst: 3, memMb: 256, priority: 2 },
  { arrival: 2, cpuBurst: 2, memMb: 64, priority: 1 },
  { arrival: 4, cpuBurst: 4, memMb: 192, priority: 3 }
];

export function CustomWorkloadBuilder() {
  const isOpen = useSimStore((s) => s.isCustomWorkloadOpen);
  const close = useSimStore((s) => s.closeCustomWorkload);
  const loadCustomWorkload = useSimStore((s) => s.loadCustomWorkload);
  const setLocation = useSimStore((s) => s.setLocation);

  const [totalMemory, setTotalMemory] = useState<number | string>(1024);
  const [processes, setProcesses] = useState<ProcessDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Requirement: Open a fresh builder with no previous process entries when opened
  useEffect(() => {
    if (isOpen) {
      setTotalMemory(1024);
      setProcesses([]);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const memCap = typeof totalMemory === 'number' ? totalMemory : parseInt(String(totalMemory), 10);

  const addProcess = () => {
    setProcesses((prev) => [
      ...prev,
      {
        arrival: prev.length > 0 ? (Number(prev[prev.length - 1].arrival) || 0) + 1 : 0,
        cpuBurst: 2,
        memMb: 128,
        priority: 1
      }
    ]);
    setError(null);
  };

  const removeProcess = (index: number) => {
    setProcesses((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const updateProcess = (index: number, field: keyof ProcessDraft, value: string | number) => {
    setProcesses((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setError(null);
  };

  const validateAndBuild = (): { valid: boolean; jobs?: Job[]; mem?: number; errorMsg?: string } => {
    if (isNaN(memCap) || memCap <= 0) {
      return { valid: false, errorMsg: 'Total memory capacity must be a positive integer.' };
    }

    if (processes.length === 0) {
      return { valid: false, errorMsg: 'Workload cannot be empty. Add at least one process.' };
    }

    const jobs: Job[] = [];

    for (let i = 0; i < processes.length; i++) {
      const p = processes[i];
      const arrival = typeof p.arrival === 'number' ? p.arrival : parseInt(String(p.arrival), 10);
      const cpuBurst = typeof p.cpuBurst === 'number' ? p.cpuBurst : parseInt(String(p.cpuBurst), 10);
      const memMb = typeof p.memMb === 'number' ? p.memMb : parseInt(String(p.memMb), 10);
      const priority = p.priority;

      if (isNaN(arrival) || arrival < 0) {
        return { valid: false, errorMsg: `Process P${i}: Arrival time must be a non-negative integer (>= 0).` };
      }
      if (isNaN(cpuBurst) || cpuBurst <= 0) {
        return { valid: false, errorMsg: `Process P${i}: CPU burst must be a positive integer (> 0).` };
      }
      if (isNaN(memMb) || memMb <= 0) {
        return { valid: false, errorMsg: `Process P${i}: Memory request must be a positive integer (> 0).` };
      }
      if (memMb > memCap) {
        return {
          valid: false,
          errorMsg: `Process P${i}: Memory request (${memMb} MB) exceeds configured total capacity (${memCap} MB).`
        };
      }
      if (priority !== 1 && priority !== 2 && priority !== 3) {
        return { valid: false, errorMsg: `Process P${i}: Priority must be 1 (High), 2 (Medium), or 3 (Low).` };
      }

      jobs.push({
        name: `P${i}`,
        arrival,
        cpuBurst,
        memMb,
        priority,
        printers: 0,
        scanners: 0,
        modems: 0,
        cds: 0
      });
    }

    return { valid: true, jobs, mem: memCap };
  };

  const handleStart = async () => {
    const check = validateAndBuild();
    if (!check.valid || !check.jobs || !check.mem) {
      setError(check.errorMsg || 'Invalid workload.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await loadCustomWorkload(check.jobs, check.mem);
      setLocation('arena');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preview calculations
  const totalBurst = processes.reduce((acc, p) => acc + (Number(p.cpuBurst) || 0), 0);
  const maxMemReq = processes.reduce((acc, p) => Math.max(acc, Number(p.memMb) || 0), 0);
  const maxArrival = processes.reduce((acc, p) => Math.max(acc, Number(p.arrival) || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-0/80 p-3 sm:p-4 backdrop-blur-xs"
      data-testid="custom-workload-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="builder-title"
    >
      <div className="panel border-2 border-gold-2 bg-ink-1 max-w-4xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-ink-3 pb-3">
          <div>
            <h2 id="builder-title" className="font-pixel text-sm sm:text-base text-gold-2">
              Manual Custom Workload Builder
            </h2>
            <p className="mt-1 text-xs text-stone-3 font-mono">
              Configure arena capacity and assemble custom adventurer processes for real C-engine simulation.
            </p>
          </div>
          <button
            type="button"
            className="btn py-1 px-2.5 text-xs text-stone-3 hover:text-gold-2 border-ink-3 hover:border-gold-2 transition-colors"
            onClick={close}
            data-testid="custom-workload-close"
            title="Close builder"
          >
            ✕
          </button>
        </div>

        {/* Error notification banner */}
        {error && (
          <div
            className="panel border-2 border-ember-2 bg-ember-0/60 p-3 text-xs text-ember-3 space-y-1"
            data-testid="custom-workload-error"
          >
            <div className="font-pixel text-[9px] uppercase tracking-wider text-ember-2">Validation Notice</div>
            <p className="font-mono font-bold text-white">{error}</p>
          </div>
        )}

        {/* Section 1: Simulation Settings */}
        <div className="panel p-3 bg-ink-0/80 border-2 border-ink-3 space-y-3">
          <h3 className="font-pixel text-[10px] text-gold-2 uppercase tracking-wider">1. Simulation Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label htmlFor="totalMemoryInput" className="block text-[11px] text-stone-3 font-semibold mb-1">
                Total Memory Capacity (MB):
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="totalMemoryInput"
                  type="number"
                  min={16}
                  step={32}
                  className="w-full bg-[#2a1f3d] border-2 border-ink-3 p-1.5 font-mono text-xs text-gold-3 font-bold placeholder:text-stone-2 focus:border-gold-2 focus:ring-2 focus:ring-gold-2/70 focus:outline-none transition-all"
                  value={totalMemory}
                  onChange={(e) => {
                    setTotalMemory(e.target.value === '' ? '' : Number(e.target.value));
                    setError(null);
                  }}
                  data-testid="input-total-memory"
                />
                <span className="font-mono text-xs text-gold-3 font-bold">MB</span>
              </div>
              <p className="text-[10px] text-stone-3/90 mt-1 font-mono">
                Default 1024 MB. Configures the physical arena size in C.
              </p>
            </div>

            <div>
              <label htmlFor="quantumInput" className="block text-[11px] text-stone-3 font-semibold mb-1">
                CPU Quantum:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="quantumInput"
                  type="text"
                  disabled
                  value="1 second (standard)"
                  className="w-full bg-ink-2/60 border-2 border-ink-3/80 p-1.5 font-mono text-xs text-stone-3 font-semibold cursor-not-allowed"
                  data-testid="input-cpu-quantum"
                />
              </div>
              <p className="text-[10px] text-stone-3/90 mt-1 font-mono">
                Retained at 1-second default scheduler quantum.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Process Details */}
        <div className="panel p-3 bg-ink-0/80 border-2 border-ink-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-pixel text-[10px] text-gold-2 uppercase tracking-wider">2. Process Details</h3>
            <button
              type="button"
              className="btn py-1.5 px-3 text-xs border-gold-2 text-gold-2 hover:bg-gold-2/20 font-semibold shadow-xs"
              onClick={addProcess}
              data-testid="btn-add-process"
            >
              + Add Process
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs" data-testid="custom-process-table">
              <thead>
                <tr className="border-b-2 border-ink-3 text-gold-3 text-[11px] font-semibold bg-ink-2/60">
                  <th className="p-2 w-14 font-pixel text-[10px] text-gold-2">PID</th>
                  <th className="p-2 min-w-[95px] text-stone-3">Arrival (t)</th>
                  <th className="p-2 min-w-[95px] text-stone-3">Burst (s)</th>
                  <th className="p-2 min-w-[105px] text-stone-3">Memory (MB)</th>
                  <th className="p-2 min-w-[125px] text-stone-3">Priority</th>
                  <th className="p-2 w-14 text-center text-stone-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {processes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-4 text-center text-xs text-stone-3 font-mono bg-ink-2/30 border-b border-ink-3"
                      data-testid="empty-processes-notice"
                    >
                      No process entries yet. Click &quot;+ Add Process&quot; above to create an adventurer, or &quot;Load Sample Workload&quot; below.
                    </td>
                  </tr>
                ) : (
                  processes.map((proc, index) => {
                    const memVal = Number(proc.memMb) || 0;
                    const isOverCap = memVal > (Number(memCap) || 1024);

                    return (
                      <tr
                        key={index}
                        className={cn(
                          'border-b-2 border-ink-2/80 transition-colors',
                          isOverCap && 'bg-ember-0/30'
                        )}
                        data-testid={`custom-process-row-${index}`}
                      >
                        {/* PID */}
                        <td className="p-2 font-pixel text-[11px] text-gold-2 font-bold">
                          P{index}
                        </td>

                        {/* Arrival */}
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            className="w-full bg-[#2a1f3d] border-2 border-ink-3 p-1.5 font-mono text-xs text-gold-3 font-bold placeholder:text-stone-2 focus:border-gold-2 focus:ring-2 focus:ring-gold-2/70 focus:outline-none transition-all"
                            value={proc.arrival}
                            onChange={(e) =>
                              updateProcess(
                                index,
                                'arrival',
                                e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10))
                              )
                            }
                            data-testid={`input-arrival-${index}`}
                          />
                        </td>

                        {/* Burst */}
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            className="w-full bg-[#2a1f3d] border-2 border-ink-3 p-1.5 font-mono text-xs text-gold-3 font-bold placeholder:text-stone-2 focus:border-gold-2 focus:ring-2 focus:ring-gold-2/70 focus:outline-none transition-all"
                            value={proc.cpuBurst}
                            onChange={(e) =>
                              updateProcess(
                                index,
                                'cpuBurst',
                                e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10))
                              )
                            }
                            data-testid={`input-burst-${index}`}
                          />
                        </td>

                        {/* Memory MB */}
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            className={cn(
                              'w-full bg-[#2a1f3d] border-2 p-1.5 font-mono text-xs font-bold transition-all focus:outline-none',
                              isOverCap
                                ? 'border-ember-2 text-ember-3 focus:ring-2 focus:ring-ember-2/70'
                                : 'border-ink-3 text-gold-3 focus:border-gold-2 focus:ring-2 focus:ring-gold-2/70'
                            )}
                            value={proc.memMb}
                            onChange={(e) =>
                              updateProcess(
                                index,
                                'memMb',
                                e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10))
                              )
                            }
                            data-testid={`input-mem-${index}`}
                          />
                        </td>

                        {/* Priority */}
                        <td className="p-2">
                          <select
                            className="w-full bg-[#2a1f3d] border-2 border-ink-3 p-1.5 font-mono text-xs text-gold-3 font-bold focus:border-gold-2 focus:ring-2 focus:ring-gold-2/70 focus:outline-none transition-all"
                            value={proc.priority}
                            onChange={(e) =>
                              updateProcess(
                                index,
                                'priority',
                                Number(e.target.value) as 1 | 2 | 3
                              )
                            }
                            data-testid={`select-priority-${index}`}
                          >
                            <option value={1} className="bg-ink-1 text-gold-3 font-mono font-medium">1 - High (Q1)</option>
                            <option value={2} className="bg-ink-1 text-gold-3 font-mono font-medium">2 - Medium (Q2)</option>
                            <option value={3} className="bg-ink-1 text-gold-3 font-mono font-medium">3 - Low (Q3)</option>
                          </select>
                        </td>

                        {/* Remove */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            className="text-stone-3 hover:text-ember-3 px-2 py-1 text-xs font-bold hover:bg-ink-3/40 rounded transition-colors"
                            onClick={() => removeProcess(index)}
                            data-testid={`btn-remove-${index}`}
                            title="Remove process"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Workload Preview */}
        <div className="panel p-3 bg-ink-0/80 border-2 border-ink-3 space-y-2" data-testid="workload-preview">
          <h3 className="font-pixel text-[10px] text-gold-2 uppercase tracking-wider">3. Workload Preview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="panel bg-[#2a1f3d] border border-ink-3 p-2">
              <span className="text-[10px] text-stone-3 font-semibold block">Total Processes</span>
              <span className="font-mono text-sm text-gold-2 font-bold" data-testid="preview-count">
                {processes.length}
              </span>
            </div>
            <div className="panel bg-[#2a1f3d] border border-ink-3 p-2">
              <span className="text-[10px] text-stone-3 font-semibold block">Total CPU Time</span>
              <span className="font-mono text-sm text-gold-3 font-bold" data-testid="preview-cpu-total">
                {totalBurst} ticks
              </span>
            </div>
            <div className="panel bg-[#2a1f3d] border border-ink-3 p-2">
              <span className="text-[10px] text-stone-3 font-semibold block">Peak Request</span>
              <span
                className={cn(
                  'font-mono text-sm font-bold',
                  maxMemReq > (Number(memCap) || 1024) ? 'text-ember-3' : 'text-water-3'
                )}
                data-testid="preview-peak-mem"
              >
                {maxMemReq} MB
              </span>
            </div>
            <div className="panel bg-[#2a1f3d] border border-ink-3 p-2">
              <span className="text-[10px] text-stone-3 font-semibold block">Arrival Span</span>
              <span className="font-mono text-sm text-gold-3 font-bold" data-testid="preview-arrival-span">
                t = 0 .. {maxArrival}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t-2 border-ink-3">
          <button
            type="button"
            className="btn py-1.5 px-3 text-xs text-stone-3 hover:text-white"
            onClick={() => setProcesses(DEFAULT_DRAFTS)}
            data-testid="btn-reset-sample"
          >
            Reset to Sample Workload
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn py-1.5 px-3 text-xs text-stone-3 hover:text-white"
              onClick={close}
              data-testid="btn-cancel-workload"
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn py-1.5 px-4 text-xs border-2 border-gold-2 bg-gold-2/20 text-gold-3 font-bold hover:bg-gold-2/30 ring-1 ring-gold-2 focus:ring-2 focus:ring-gold-2 transition-all"
              onClick={() => void handleStart()}
              disabled={isSubmitting}
              data-testid="btn-start-simulation"
            >
              {isSubmitting ? 'Initializing Engine…' : 'Start Simulation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
