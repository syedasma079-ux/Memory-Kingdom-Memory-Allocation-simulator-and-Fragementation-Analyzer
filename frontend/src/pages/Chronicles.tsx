import { useEffect, useMemo, useRef, useState } from 'react';
import { useSimStore } from '../store/simStore';
import { drawSprite } from '../game/spriteAtlas';
import type { EngineEvent, EngineSnapshot } from '../types/engine';

const KINDS = [
  'all',
  'process_arrived',
  'process_admitted',
  'process_dispatched',
  'process_demoted',
  'process_terminated',
  'memory_released',
  'alloc_failed',
  'idle',
  'sim_finished'
] as const;

const KIND_BADGE_STYLE: Record<string, string> = {
  process_arrived: 'bg-sky-950/70 text-sky-300 border-sky-800/60',
  process_admitted: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60',
  process_dispatched: 'bg-amber-950/70 text-gold-2 border-amber-800/60',
  process_demoted: 'bg-purple-950/70 text-purple-300 border-purple-800/60',
  process_terminated: 'bg-blue-950/70 text-blue-300 border-blue-800/60',
  memory_released: 'bg-teal-950/70 text-teal-300 border-teal-800/60',
  alloc_failed: 'bg-rose-950/70 text-rose-300 border-rose-800/60',
  idle: 'bg-stone-900 text-stone-400 border-stone-700',
  sim_finished: 'bg-amber-900/60 text-amber-300 border-amber-700'
};

function renderEventDetails(e: EngineEvent) {
  const d = e.data || {};
  switch (e.kind) {
    case 'process_arrived': {
      const pid = d.pid !== undefined ? `P${d.pid}` : (d.name as string) || 'Process';
      const mem = d.memMb !== undefined ? `${d.memMb} MB` : '';
      const burst = d.cpuBurst !== undefined ? `${d.cpuBurst} ticks` : '';
      const prio = d.priority !== undefined ? `prio ${d.priority}` : '';
      return (
        <span className="text-stone-1">
          <strong className="text-sky-300 font-pixel text-[10px]">{pid}</strong> arrived in realm
          {prio && <span className="ml-1 text-stone-3">({prio})</span>}
          {mem && <span className="ml-2 px-1.5 py-0.5 rounded bg-ink-2 text-cyan-200">Req: {mem}</span>}
          {burst && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-ink-2 text-amber-200">Burst: {burst}</span>}
        </span>
      );
    }
    case 'process_admitted': {
      const pid = d.pid !== undefined ? `P${d.pid}` : (d.name as string) || 'Process';
      const offset =
        d.offset !== undefined ? `@ 0x${Number(d.offset).toString(16).padStart(4, '0')} (${d.offset})` : '';
      const size = d.size !== undefined ? `${d.size} MB` : '';
      const policy = d.policy ? `via ${d.policy}` : '';
      return (
        <span className="text-stone-1">
          <strong className="text-emerald-300 font-pixel text-[10px]">{pid}</strong> admitted into arena
          {offset && <span className="ml-1.5 font-mono text-emerald-200">{offset}</span>}
          {size && <span className="ml-2 px-1.5 py-0.5 rounded bg-ink-2 text-emerald-300">{size}</span>}
          {policy && <span className="ml-2 text-stone-3 italic">{policy}</span>}
        </span>
      );
    }
    case 'process_dispatched': {
      const name = (d.name as string) || (d.pid !== undefined ? `P${d.pid}` : 'Process');
      const queue = d.queueLevel !== undefined ? `Q${d.queueLevel}` : d.queue !== undefined ? `Q${d.queue}` : '';
      const rem = d.remaining !== undefined ? `${d.remaining} ticks left` : '';
      return (
        <span className="text-stone-1">
          <strong className="text-gold-2 font-pixel text-[10px]">{name}</strong> dispatched to Royal CPU
          {queue && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-gold-2/10 text-gold-2 border border-gold-2/30">
              {queue}
            </span>
          )}
          {rem && <span className="ml-2 text-stone-2">({rem})</span>}
        </span>
      );
    }
    case 'process_demoted': {
      const name = (d.name as string) || (d.pid !== undefined ? `P${d.pid}` : 'Process');
      const fromQ =
        d.fromQueue !== undefined ? String(d.fromQueue) : d.from !== undefined ? String(d.from) : '';
      const toQ =
        d.toQueue !== undefined ? String(d.toQueue) : d.to !== undefined ? String(d.to) : '';
      const reason = d.reason ? String(d.reason) : '';
      return (
        <span className="text-stone-1">
          <strong className="text-purple-300 font-pixel text-[10px]">{name}</strong> demoted
          {fromQ && toQ && <span className="ml-1 text-stone-3">(Q{fromQ} &rarr; Q{toQ})</span>}
          {reason && <span className="ml-2 text-rose-300 italic">{reason}</span>}
        </span>
      );
    }
    case 'process_terminated': {
      const name = (d.name as string) || (d.pid !== undefined ? `P${d.pid}` : 'Process');
      const finish = d.finishTime !== undefined ? `t=${d.finishTime}` : '';
      const ta = d.turnaround !== undefined ? `turnaround ${d.turnaround} ticks` : '';
      return (
        <span className="text-stone-1">
          <strong className="text-blue-300 font-pixel text-[10px]">{name}</strong> completed execution
          {finish && <span className="ml-2 text-stone-3">[{finish}]</span>}
          {ta && <span className="ml-2 px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-200">{ta}</span>}
        </span>
      );
    }
    case 'memory_released': {
      const name = (d.name as string) || (d.pid !== undefined ? `P${d.pid}` : 'Process');
      const size = d.size !== undefined ? `${d.size} MB` : '';
      const offset = d.offset !== undefined ? `@ offset ${d.offset}` : '';
      const surv = d.survivorSize !== undefined ? `merged hole: ${d.survivorSize} MB` : '';
      return (
        <span className="text-stone-1">
          Released {size} from <strong className="text-teal-300 font-pixel text-[10px]">{name}</strong> {offset}
          {surv && <span className="ml-2 px-1.5 py-0.5 rounded bg-teal-900/40 text-teal-200">({surv})</span>}
        </span>
      );
    }
    case 'alloc_failed': {
      const pid = d.pid !== undefined ? `P${d.pid}` : (d.name as string) || 'Process';
      const size = d.size !== undefined ? `${d.size} MB` : '';
      const reason = d.reason ? String(d.reason) : 'No contiguous free block';
      return (
        <span className="text-rose-200">
          Allocation failed for <strong className="text-rose-400 font-pixel text-[10px]">{pid}</strong> ({size}):{' '}
          {reason}
        </span>
      );
    }
    case 'idle': {
      return <span className="text-stone-3 italic">CPU idle · No ready tasks in scheduling queue</span>;
    }
    case 'sim_finished': {
      const makespan = d.makespan !== undefined ? `Total makespan: ${d.makespan} ticks` : '';
      return (
        <span className="text-amber-200 font-pixel text-[10px]">
          Simulation Finished {makespan && <span className="ml-2 text-stone-2">({makespan})</span>}
        </span>
      );
    }
    default: {
      return <span className="text-stone-3">{JSON.stringify(d)}</span>;
    }
  }
}

function getEventNarrative(e: EngineEvent | null): {
  headline: string;
  story: string;
  chips: Array<{ label: string; value: string; color?: string }>;
} {
  if (!e) {
    return {
      headline: 'Awaiting Kingdom Activity',
      story: 'No event is currently selected. Use the playback controls or click an event in the timeline.',
      chips: []
    };
  }

  const d = e.data || {};
  const pid = d.pid !== undefined ? `P${d.pid}` : (d.name as string) || 'Process';

  switch (e.kind) {
    case 'process_arrived': {
      const mem = d.memMb !== undefined ? `${d.memMb} MB` : 'unknown size';
      const burst = d.cpuBurst !== undefined ? `${d.cpuBurst} ticks` : '';
      return {
        headline: `${pid} Arrived at Kingdom Gates`,
        story: `Adventurer ${pid} entered the kingdom boundaries seeking memory admission (${mem}) with an estimated CPU burst of ${burst}.`,
        chips: [
          { label: 'Adventurer', value: String(pid) },
          { label: 'Memory Request', value: mem, color: 'text-cyan-300' },
          { label: 'CPU Burst', value: burst, color: 'text-amber-300' },
          ...(d.priority !== undefined ? [{ label: 'Priority', value: String(d.priority) }] : [])
        ]
      };
    }
    case 'process_admitted': {
      const offset = d.offset !== undefined ? `@ 0x${Number(d.offset).toString(16).padStart(4, '0')} (${d.offset})` : '';
      const size = d.size !== undefined ? `${d.size} MB` : '';
      const policy = d.policy ? String(d.policy) : 'configured policy';
      return {
        headline: `${pid} Admitted into Memory Territory`,
        story: `Royal allocation algorithm (${policy}) assigned ${size} to adventurer ${pid} at offset ${offset}.`,
        chips: [
          { label: 'Adventurer', value: String(pid) },
          { label: 'Allocated Range', value: `${offset} (${size})`, color: 'text-emerald-300' },
          { label: 'Algorithm', value: policy, color: 'text-gold-2' }
        ]
      };
    }
    case 'process_dispatched': {
      const q = d.queueLevel !== undefined ? `Q${d.queueLevel}` : d.queue !== undefined ? `Q${d.queue}` : 'MLFQ';
      const rem = d.remaining !== undefined ? `${d.remaining} ticks` : '';
      return {
        headline: `${pid} Dispatched to Royal CPU Core`,
        story: `The MLFQ scheduler selected ${pid} from ${q} and granted access to the execution core (${rem} remaining).`,
        chips: [
          { label: 'Adventurer', value: String(pid) },
          { label: 'Queue Level', value: q, color: 'text-gold-2' },
          { label: 'Remaining Burst', value: rem, color: 'text-amber-300' }
        ]
      };
    }
    case 'process_demoted': {
      const fromQ = d.fromQueue !== undefined ? `Q${d.fromQueue}` : '';
      const toQ = d.toQueue !== undefined ? `Q${d.toQueue}` : '';
      const reason = d.reason ? String(d.reason) : 'Time quantum expired';
      return {
        headline: `${pid} Demoted Down MLFQ Queue`,
        story: `Adventurer ${pid} could not finish within their allotted time slice and was demoted (${fromQ} → ${toQ}).`,
        chips: [
          { label: 'Adventurer', value: String(pid) },
          { label: 'Queue Shift', value: `${fromQ} → ${toQ}`, color: 'text-purple-300' },
          { label: 'Trigger', value: reason, color: 'text-rose-300' }
        ]
      };
    }
    case 'process_terminated': {
      const finish = d.finishTime !== undefined ? `Tick ${d.finishTime}` : '';
      const ta = d.turnaround !== undefined ? `${d.turnaround} ticks` : '';
      return {
        headline: `${pid} Fulfilled Royal Quest`,
        story: `Adventurer ${pid} completed all CPU execution tasks at ${finish} with a turnaround duration of ${ta}.`,
        chips: [
          { label: 'Adventurer', value: String(pid) },
          { label: 'Finish Time', value: finish, color: 'text-blue-300' },
          { label: 'Turnaround', value: ta, color: 'text-blue-200' }
        ]
      };
    }
    case 'memory_released': {
      const size = d.size !== undefined ? `${d.size} MB` : '';
      const surv = d.survivorSize !== undefined ? `${d.survivorSize} MB` : '';
      return {
        headline: `Memory Territory Reclaimed`,
        story: `Released ${size} previously held by ${pid}. Coalesced adjacent free space into a ${surv} continuous block.`,
        chips: [
          { label: 'Released By', value: String(pid) },
          { label: 'Freed Memory', value: size, color: 'text-teal-300' },
          { label: 'Merged Free Hole', value: surv, color: 'text-emerald-300' }
        ]
      };
    }
    case 'alloc_failed': {
      const size = d.size !== undefined ? `${d.size} MB` : '';
      const reason = d.reason ? String(d.reason) : 'No contiguous free block';
      return {
        headline: `Allocation Stalled for ${pid}`,
        story: `Adventurer ${pid} requested ${size}, but the allocation policy could not locate an adequate free memory block (${reason}).`,
        chips: [
          { label: 'Adventurer', value: String(pid) },
          { label: 'Required Memory', value: size, color: 'text-rose-400' },
          { label: 'Failure Cause', value: reason, color: 'text-rose-300' }
        ]
      };
    }
    case 'idle': {
      return {
        headline: 'Royal CPU Idle',
        story: `No adventurer processes are currently ready in any scheduling queue. Royal CPU rests at Tick ${e.t}.`,
        chips: [
          { label: 'Core State', value: 'IDLE', color: 'text-stone-400' },
          { label: 'Simulation Time', value: `Tick ${e.t}`, color: 'text-gold-2' }
        ]
      };
    }
    case 'sim_finished': {
      const makespan = d.makespan !== undefined ? `${d.makespan} ticks` : '';
      return {
        headline: 'Kingdom Simulation Concluded',
        story: `All workloads have completed execution! Final simulation makespan reached ${makespan}.`,
        chips: [
          { label: 'Status', value: 'FINISHED', color: 'text-amber-300' },
          { label: 'Makespan', value: makespan, color: 'text-gold-2' }
        ]
      };
    }
    default: {
      return {
        headline: `Event: ${e.kind}`,
        story: `Event sequence #${e.seq} at Tick ${e.t}.`,
        chips: [{ label: 'Kind', value: e.kind }]
      };
    }
  }
}

function EventTheater({
  event,
  reducedMotion
}: {
  event: EngineEvent | null;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !event) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let animTick = 0;

    const render = () => {
      animTick++;
      const w = 480;
      const h = 120;
      ctx.imageSmoothingEnabled = false;

      // Draw background
      ctx.clearRect(0, 0, w, h);

      if (event.kind === 'alloc_failed') {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#120e1c');
        grad.addColorStop(0.6, '#4a1420');
        grad.addColorStop(1, '#241a38');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#3c3a41';
        ctx.fillRect(0, 80, w, 40);
        ctx.fillStyle = '#d4483b';
        ctx.fillRect(140, 90, 60, 2);
      } else if (event.kind === 'idle' || event.kind === 'process_demoted') {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#120e1c');
        grad.addColorStop(0.5, '#241a38');
        grad.addColorStop(1, '#3a2c55');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#3c3a41';
        ctx.fillRect(0, 80, w, 40);
        ctx.fillStyle = '#241a38';
        for (let x = 0; x < w; x += 32) {
          ctx.fillRect(x, 80, 28, 40);
        }
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#17304f');
        grad.addColorStop(0.5, '#1f5a8a');
        grad.addColorStop(1, '#3b8fc4');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Castle silhouette
        ctx.fillStyle = '#241a38';
        ctx.fillRect(360, 25, 80, 55);
        ctx.fillRect(350, 40, 100, 40);
        ctx.fillRect(370, 10, 20, 15);
        ctx.fillRect(410, 10, 20, 15);

        // Meadow & pathway
        ctx.fillStyle = '#1f3d2b';
        ctx.fillRect(0, 80, w, 40);
        ctx.fillStyle = '#2f6b3a';
        ctx.fillRect(0, 80, w, 4);

        ctx.fillStyle = '#5e5b66';
        ctx.fillRect(0, 90, w, 22);
        ctx.fillStyle = '#8c8996';
        for (let x = 0; x < w; x += 24) {
          ctx.fillRect(x, 92, 18, 18);
        }
      }

      // Draw actor sprites
      const d = event.data || {};
      const pidNum = typeof d.pid === 'number' ? d.pid : 0;
      const classes = ['warrior', 'mage', 'rogue', 'cleric'];
      const cls = classes[Math.abs(pidNum) % classes.length];
      const frame = !reducedMotion && Math.floor(animTick / 20) % 2 === 1 ? 2 : 1;
      const adventurerSprite = `adventurer_${cls}_f${frame}`;
      const bob = !reducedMotion && Math.floor(animTick / 15) % 2 === 1 ? -1 : 0;

      switch (event.kind) {
        case 'process_arrived':
          drawSprite(ctx, adventurerSprite, 80, 42 + bob, 2);
          drawSprite(ctx, 'kingdom_flag', 400, 25, 2);
          break;
        case 'process_admitted':
          drawSprite(ctx, 'territory_alloc_water', 180, 75, 2);
          drawSprite(ctx, 'territory_alloc_water', 212, 75, 2);
          drawSprite(ctx, adventurerSprite, 188, 38 + bob, 2);
          drawSprite(ctx, 'kingdom_flag', 400, 25, 2);
          break;
        case 'process_dispatched':
          drawSprite(ctx, adventurerSprite, 220, 38 + bob, 2);
          drawSprite(ctx, 'guild_wandering_knights', 360, 25, 2);
          break;
        case 'process_demoted':
          drawSprite(ctx, adventurerSprite, 180, 44 + bob, 2);
          break;
        case 'process_terminated':
          drawSprite(ctx, adventurerSprite, 200, 38 + bob, 2);
          drawSprite(ctx, 'kingdom_flag', 160, 25, 2);
          drawSprite(ctx, 'kingdom_flag', 250, 25, 2);
          break;
        case 'memory_released':
          drawSprite(ctx, 'territory_free_grass', 180, 75, 2);
          drawSprite(ctx, 'territory_free_grass', 212, 75, 2);
          drawSprite(ctx, adventurerSprite, 130, 42 + bob, 2);
          break;
        case 'alloc_failed':
          drawSprite(ctx, adventurerSprite, 100, 42, 2);
          drawSprite(ctx, 'dragon_tier1_stirring', 320, 18, 2);
          break;
        case 'idle':
          drawSprite(ctx, 'dragon_tier0_sleeping', 200, 35, 2);
          break;
        case 'sim_finished':
          drawSprite(ctx, 'guild_wandering_knights', 150, 22, 2);
          drawSprite(ctx, 'guild_swift_rangers', 220, 22, 2);
          drawSprite(ctx, 'guild_precision_architects', 290, 22, 2);
          break;
        default:
          drawSprite(ctx, adventurerSprite, 180, 40, 2);
          break;
      }

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [event, reducedMotion]);

  if (!event) return null;

  const narrative = getEventNarrative(event);

  return (
    <div className="panel p-3 bg-ink-2/60 border-ink-3 space-y-3" data-testid="chronicles-scene">
      <div className="relative rounded overflow-hidden border border-ink-3 bg-ink-0">
        <canvas
          ref={canvasRef}
          width={480}
          height={120}
          className="w-full h-auto max-h-[140px] block image-pixelated"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-ink-0/80 backdrop-blur px-2 py-0.5 rounded border border-ink-3">
          <span className="font-pixel text-[10px] text-gold-2">#{event.seq}</span>
          <span className="text-[10px] text-stone-3 font-mono">t={event.t}</span>
          <span
            className={`inline-block px-1.5 py-0.2 rounded text-[9px] uppercase font-pixel border ${
              KIND_BADGE_STYLE[event.kind] || 'border-stone-700 text-stone-300'
            }`}
          >
            {event.kind}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-pixel text-xs text-gold-2">{narrative.headline}</h3>
          <span className="text-[10px] font-mono text-stone-4">
            Seq #{event.seq} · Sim Tick {event.t}
          </span>
        </div>
        <p className="text-xs text-stone-2 leading-relaxed">{narrative.story}</p>
        {narrative.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {narrative.chips.map((chip, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-ink-1 text-[11px] font-mono border border-ink-3"
              >
                <span className="text-stone-4 mr-1">{chip.label}:</span>
                <strong className={chip.color || 'text-stone-1'}>{chip.value}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Chronicles() {
  const events = useSimStore((s) => s.events);
  const snapshots = useSimStore((s) => s.snapshots);
  const cursor = useSimStore((s) => s.cursor);
  const setCursor = useSimStore((s) => s.setCursor);
  const syncEvents = useSimStore((s) => s.syncEvents);
  const reducedMotion = useSimStore((s) => s.reducedMotion);

  const [filter, setFilter] = useState<(typeof KINDS)[number]>('all');
  const [selectedEventIndex, setSelectedEventIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (typeof syncEvents === 'function') {
      void syncEvents();
    }
  }, [syncEvents]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.kind] = (counts[e.kind] || 0) + 1;
    }
    return counts;
  }, [events]);

  const filteredEvents = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.kind === filter)),
    [events, filter]
  );

  const selectedEvent = useMemo(() => {
    if (filteredEvents.length === 0) return null;
    const safeIdx = Math.min(Math.max(0, selectedEventIndex), filteredEvents.length - 1);
    return filteredEvents[safeIdx] || null;
  }, [filteredEvents, selectedEventIndex]);

  // Synchronized snapshot matching the selected event
  const syncedSnapshot: EngineSnapshot | null = useMemo(() => {
    if (!selectedEvent) return null;
    return (
      snapshots.find((s) => s.seq >= selectedEvent.seq) ||
      (cursor >= 0 && cursor < snapshots.length ? snapshots[cursor] : null) ||
      (snapshots.length > 0 ? snapshots[snapshots.length - 1] : null)
    );
  }, [selectedEvent, snapshots, cursor]);

  // Groups of events organized by simulation tick
  const tickGroups = useMemo(() => {
    const groups: Array<{ tick: number; events: EngineEvent[] }> = [];
    let currentTick: number | null = null;
    let currentList: EngineEvent[] = [];

    for (const e of filteredEvents) {
      if (e.t !== currentTick) {
        if (currentList.length > 0 && currentTick !== null) {
          groups.push({ tick: currentTick, events: currentList });
        }
        currentTick = e.t;
        currentList = [e];
      } else {
        currentList.push(e);
      }
    }
    if (currentList.length > 0 && currentTick !== null) {
      groups.push({ tick: currentTick, events: currentList });
    }
    return groups;
  }, [filteredEvents]);

  // Handle filter selection
  const handleFilterChange = (k: (typeof KINDS)[number]) => {
    setFilter(k);
    setSelectedEventIndex(0);
    setIsPlaying(false);
  };

  // Replay timer
  useEffect(() => {
    if (!isPlaying) return;
    if (filteredEvents.length <= 1) {
      setIsPlaying(false);
      return;
    }

    const timer = setInterval(() => {
      setSelectedEventIndex((prev) => {
        if (prev >= filteredEvents.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [isPlaying, filteredEvents.length]);

  // Auto scrub snapshot when selected event changes
  useEffect(() => {
    if (!selectedEvent) return;
    const snapIdx = snapshots.findIndex((s) => s.seq >= selectedEvent.seq);
    if (snapIdx >= 0) {
      setCursor(snapIdx);
    }
  }, [selectedEvent?.seq, snapshots, setCursor]);

  const handlePrevEvent = () => {
    setSelectedEventIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextEvent = () => {
    setSelectedEventIndex((prev) => Math.min(filteredEvents.length - 1, prev + 1));
  };

  const handlePrevTick = () => {
    if (!selectedEvent) return;
    const currentTick = selectedEvent.t;
    // Find previous tick with events in filtered list
    for (let i = selectedEventIndex - 1; i >= 0; i--) {
      if (filteredEvents[i].t < currentTick) {
        setSelectedEventIndex(i);
        return;
      }
    }
  };

  const handleNextTick = () => {
    if (!selectedEvent) return;
    const currentTick = selectedEvent.t;
    // Find next tick with events in filtered list
    for (let i = selectedEventIndex + 1; i < filteredEvents.length; i++) {
      if (filteredEvents[i].t > currentTick) {
        setSelectedEventIndex(i);
        return;
      }
    }
  };

  const togglePlay = () => {
    if (!isPlaying && selectedEventIndex >= filteredEvents.length - 1) {
      setSelectedEventIndex(0);
    }
    setIsPlaying((p) => !p);
  };

  return (
    <section data-testid="page-chronicles" className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-pixel text-sm text-gold-2">Simulation Chronicles: Kingdom Timeline</h2>
          <p className="mt-1 text-xs text-stone-2">
            Interactive 16-bit visual timeline of real C-engine memory allocation and MLFQ scheduling events.
          </p>
        </div>
        <div className="font-mono text-xs text-stone-3 flex items-center gap-3">
          <span>
            Total Events: <strong className="text-gold-2">{events.length}</strong>
          </span>
          {filter !== 'all' && (
            <span>
              Filtered: <strong className="text-stone-1">{filteredEvents.length}</strong>
            </span>
          )}
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase font-pixel text-stone-4 tracking-wider">
          Filter Event Timeline:
        </span>
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Event filters">
          {KINDS.map((k) => {
            const count = k === 'all' ? events.length : kindCounts[k] || 0;
            const isActive = filter === k;
            return (
              <button
                key={k}
                type="button"
                className={`btn text-xs transition ${
                  isActive ? 'bg-gold-2 text-ink-0 font-bold border-gold-2 shadow-sm' : ''
                }`}
                data-testid={`chronicles-filter-${k}`}
                aria-pressed={isActive}
                onClick={() => handleFilterChange(k)}
              >
                {k}
                <span
                  className={`ml-1.5 font-mono text-[10px] ${
                    isActive ? 'text-ink-0/80 font-bold' : 'text-stone-4'
                  }`}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {events.length === 0 ? (
        <div className="panel p-6 text-center text-xs text-stone-2 space-y-2" data-testid="chronicles-empty">
          <p className="font-pixel text-gold-2 text-sm">No events recorded yet.</p>
          <p className="text-stone-3 max-w-md mx-auto">
            The chronicles are waiting for kingdom activity. Load the assignment workload (or a random scenario) and
            press <strong className="text-gold-2">Start</strong> or <strong className="text-gold-2">Step Tick</strong> in
            the Royal Time Controls above to observe real simulation events.
          </p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="panel p-4 text-center text-xs text-stone-3 space-y-2" data-testid="chronicles-no-matches">
          <p>No events matching filter &ldquo;{filter}&rdquo;. (Total events in chronicle: {events.length})</p>
          <div>
            <button
              type="button"
              className="btn text-xs"
              onClick={() => handleFilterChange('all')}
            >
              Show All Events
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Visual Event Theater & Replay Controls */}
          <div className="space-y-2">
            <EventTheater event={selectedEvent} reducedMotion={reducedMotion} />

            {/* Replay Controls Bar */}
            <div
              className="panel p-2.5 flex flex-wrap items-center justify-between gap-3 bg-ink-2/40 border-ink-3"
              role="toolbar"
              aria-label="Event Replay Controls"
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn px-2.5 py-1 text-xs"
                  data-testid="chronicles-prev-tick"
                  onClick={handlePrevTick}
                  disabled={selectedEventIndex <= 0}
                  title="Jump to previous simulation tick"
                >
                  |&lt; Tick
                </button>
                <button
                  type="button"
                  className="btn px-3 py-1 text-xs"
                  data-testid="chronicles-prev"
                  onClick={handlePrevEvent}
                  disabled={selectedEventIndex <= 0}
                  title="Previous event"
                >
                  &lt; Prev
                </button>
                <button
                  type="button"
                  className={`btn px-4 py-1 text-xs font-bold ${
                    isPlaying ? 'bg-gold-2 text-ink-0 border-gold-2' : ''
                  }`}
                  data-testid="chronicles-play-pause"
                  onClick={togglePlay}
                  title={isPlaying ? 'Pause replay' : 'Play replay'}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                  type="button"
                  className="btn px-3 py-1 text-xs"
                  data-testid="chronicles-next"
                  onClick={handleNextEvent}
                  disabled={selectedEventIndex >= filteredEvents.length - 1}
                  title="Next event"
                >
                  Next &gt;
                </button>
                <button
                  type="button"
                  className="btn px-2.5 py-1 text-xs"
                  data-testid="chronicles-next-tick"
                  onClick={handleNextTick}
                  disabled={selectedEventIndex >= filteredEvents.length - 1}
                  title="Jump to next simulation tick"
                >
                  Tick &gt;|
                </button>
              </div>

              <div
                className="flex items-center gap-2 font-mono text-xs text-stone-3"
                data-testid="chronicles-progress"
              >
                <span>
                  Event <strong className="text-gold-2">{selectedEventIndex + 1}</strong> of{' '}
                  <strong className="text-stone-1">{filteredEvents.length}</strong>
                </span>
                {filter !== 'all' && (
                  <span className="text-[10px] text-stone-4 uppercase">({filter})</span>
                )}
              </div>
            </div>
          </div>

          {/* Synchronized Kingdom State Bar (Engine Data) */}
          <div className="panel p-3 space-y-2 bg-ink-2/40 border-ink-3">
            <div className="flex flex-wrap items-center justify-between text-xs gap-2">
              <div className="font-pixel text-[10px] text-gold-2 flex items-center gap-1.5">
                <span>Kingdom State Synchronization</span>
                {syncedSnapshot && (
                  <span className="text-stone-3 font-mono font-normal">
                    (Snapshot #{syncedSnapshot.seq} @ Tick {syncedSnapshot.t})
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-stone-3">
                {selectedEvent ? (
                  <span>
                    Event: <strong className="text-gold-2">#{selectedEvent.seq}</strong> at{' '}
                    <strong className="text-gold-2">Tick {selectedEvent.t}</strong>
                  </span>
                ) : (
                  'No event selected'
                )}
              </div>
            </div>

            {/* Memory Territory Proportional Layout Bar */}
            {syncedSnapshot?.arena && (
              <div className="space-y-1">
                <div className="flex flex-wrap justify-between text-[10px] font-mono text-stone-3">
                  <span>Memory Arena ({syncedSnapshot.arena.total} MB)</span>
                  <span>
                    Allocated: <strong className="text-emerald-300">{syncedSnapshot.arena.statistics.allocated} MB</strong>{' '}
                    ({syncedSnapshot.arena.statistics.utilization.toFixed(1)}%) · Free:{' '}
                    <strong className="text-stone-1">{syncedSnapshot.arena.statistics.free} MB</strong> · Largest Hole:{' '}
                    <strong className="text-stone-2">{syncedSnapshot.arena.statistics.largestFree} MB</strong>
                  </span>
                </div>
                <div
                  className="flex h-4 w-full rounded overflow-hidden border border-ink-3 bg-stone-900"
                  title="Engine Memory Blocks Layout"
                >
                  {syncedSnapshot.arena.blocks.map((b, i) => {
                    const pct = (b.size / (syncedSnapshot.arena.total || 1024)) * 100;
                    const isSelectedProc =
                      selectedEvent?.data?.pid !== undefined && b.pid === selectedEvent.data.pid;
                    return (
                      <div
                        key={i}
                        style={{ width: `${Math.max(pct, 0.4)}%` }}
                        className={`h-full border-r border-ink-0/30 transition-all ${
                          b.allocated
                            ? isSelectedProc
                              ? 'bg-gold-2 animate-pulse'
                              : 'bg-emerald-600'
                            : 'bg-stone-800'
                        }`}
                        title={
                          b.allocated
                            ? `P${b.pid}: ${b.size} MB @ offset ${b.offset}`
                            : `Free Block: ${b.size} MB @ offset ${b.offset}`
                        }
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* MLFQ Scheduling Queues */}
            {syncedSnapshot?.queues && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                <div className="bg-ink-1/60 p-1.5 rounded border border-ink-3">
                  <div className="text-stone-4 text-[9px] uppercase font-pixel">Running Core</div>
                  <div className="text-gold-2 font-bold truncate">
                    {syncedSnapshot.runningPid >= 0 ? `P${syncedSnapshot.runningPid}` : 'IDLE'}
                  </div>
                </div>
                <div className="bg-ink-1/60 p-1.5 rounded border border-ink-3">
                  <div className="text-stone-4 text-[9px] uppercase font-pixel">Q1 (High)</div>
                  <div className="text-stone-2 truncate">
                    {syncedSnapshot.queues.q1?.length > 0
                      ? syncedSnapshot.queues.q1.map((p) => `P${p}`).join(', ')
                      : 'Empty'}
                  </div>
                </div>
                <div className="bg-ink-1/60 p-1.5 rounded border border-ink-3">
                  <div className="text-stone-4 text-[9px] uppercase font-pixel">Q2 (Mid)</div>
                  <div className="text-stone-2 truncate">
                    {syncedSnapshot.queues.q2?.length > 0
                      ? syncedSnapshot.queues.q2.map((p) => `P${p}`).join(', ')
                      : 'Empty'}
                  </div>
                </div>
                <div className="bg-ink-1/60 p-1.5 rounded border border-ink-3">
                  <div className="text-stone-4 text-[9px] uppercase font-pixel">Q3 (Low)</div>
                  <div className="text-stone-2 truncate">
                    {syncedSnapshot.queues.q3?.length > 0
                      ? syncedSnapshot.queues.q3.map((p) => `P${p}`).join(', ')
                      : 'Empty'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visual Kingdom Timeline (Grouped by Tick) */}
          <div className="space-y-4" data-testid="visual-timeline">
            <h3 className="font-pixel text-xs text-gold-2 flex items-center justify-between">
              <span>Chronological Event Flow</span>
              <span className="text-[10px] text-stone-4 font-mono font-normal">
                Click any event to scrub memory snapshots
              </span>
            </h3>

            <div className="space-y-4">
              {tickGroups.map((group) => (
                <div
                  key={`tick-${group.tick}`}
                  className="relative pl-6 border-l-2 border-gold-2/30 space-y-2"
                  data-testid={`timeline-tick-${group.tick}`}
                >
                  {/* Tick Node Marker */}
                  <div className="absolute -left-[9px] top-0 flex items-center justify-center w-4 h-4 rounded-full bg-ink-0 border-2 border-gold-2 text-[8px] font-pixel text-gold-2">
                    {group.tick}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-pixel text-xs text-gold-2">TICK {group.tick}</span>
                    <span className="font-mono text-[10px] text-stone-4">
                      ({group.events.length} {group.events.length === 1 ? 'event' : 'events'})
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.events.map((e) => {
                      const isSelected = selectedEvent?.seq === e.seq;
                      return (
                        <button
                          key={`${e.seq}-${e.kind}`}
                          type="button"
                          className={`w-full text-left p-2 rounded transition border ${
                            isSelected
                              ? 'bg-ink-2/90 border-gold-2 shadow-md ring-1 ring-gold-2/50'
                              : 'bg-ink-1/40 border-ink-3 hover:border-gold-2/40 hover:bg-ink-2/50'
                          }`}
                          data-testid={`event-seq-${e.seq}`}
                          onClick={() => {
                            const idx = filteredEvents.findIndex((ev) => ev.seq === e.seq);
                            if (idx >= 0) setSelectedEventIndex(idx);
                            const snapIdx = snapshots.findIndex((s) => s.seq >= e.seq);
                            if (snapIdx >= 0) setCursor(snapIdx);
                          }}
                          title="Click to select event and scrub snapshot"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-stone-4 font-mono font-semibold">[{e.seq}]</span>
                            <span className="font-pixel text-[10px] text-gold-2">t={e.t}</span>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase font-pixel border ${
                                KIND_BADGE_STYLE[e.kind] || 'border-stone-700 text-stone-300'
                              }`}
                            >
                              {e.kind}
                            </span>
                            <div className="flex-1 min-w-[220px]">
                              {renderEventDetails(e)}
                            </div>
                          </div>
                          <div className="mt-1 text-[10px] text-stone-4 truncate font-mono">
                            [{e.seq}] t={e.t} {e.kind} {JSON.stringify(e.data)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Collapsible Technical Details (Raw JSON & Engine Stream) */}
          <details className="panel p-3 bg-ink-2/30 border-ink-3 space-y-3" data-testid="technical-details">
            <summary className="font-pixel text-xs text-gold-2 cursor-pointer hover:text-gold-1">
              ▶ Technical Details & Raw Event Stream
            </summary>

            <div className="mt-3 space-y-3">
              {selectedEvent && (
                <div className="p-2 bg-ink-1/70 rounded border border-ink-3">
                  <h4 className="font-pixel text-[10px] text-stone-2 mb-1">
                    Selected Event Raw Payload [#{selectedEvent.seq}]
                  </h4>
                  <pre className="font-mono text-[10px] text-gold-2 overflow-x-auto p-2 bg-ink-0/80 rounded">
                    {JSON.stringify(selectedEvent, null, 2)}
                  </pre>
                </div>
              )}

              {syncedSnapshot && (
                <div className="p-2 bg-ink-1/70 rounded border border-ink-3">
                  <h4 className="font-pixel text-[10px] text-stone-2 mb-1">
                    Historical Snapshot State (Seq #{syncedSnapshot.seq}, Tick {syncedSnapshot.t})
                  </h4>
                  <pre className="font-mono text-[10px] text-stone-3 overflow-x-auto p-2 bg-ink-0/80 rounded">
                    {JSON.stringify(
                      {
                        t: syncedSnapshot.t,
                        seq: syncedSnapshot.seq,
                        runningPid: syncedSnapshot.runningPid,
                        isFinished: syncedSnapshot.isFinished,
                        queues: syncedSnapshot.queues,
                        statistics: syncedSnapshot.arena.statistics
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="font-pixel text-[10px] text-stone-2 mb-1">
                  Chronological Stream Log ({filteredEvents.length} events)
                </h4>
                <ol
                  className="max-h-[220px] space-y-1 overflow-auto p-2 font-mono text-[10px] bg-ink-0/80 rounded border border-ink-3"
                  data-testid="event-log"
                >
                  {filteredEvents.map((e) => (
                    <li
                      key={`raw-${e.seq}`}
                      className={`p-1 rounded cursor-pointer ${
                        selectedEvent?.seq === e.seq
                          ? 'bg-gold-2/20 text-gold-2'
                          : 'hover:bg-ink-2 text-stone-3'
                      }`}
                      onClick={() => {
                        const idx = filteredEvents.findIndex((ev) => ev.seq === e.seq);
                        if (idx >= 0) setSelectedEventIndex(idx);
                        const snapIdx = snapshots.findIndex((s) => s.seq >= e.seq);
                        if (snapIdx >= 0) setCursor(snapIdx);
                      }}
                    >
                      [{e.seq}] t={e.t} {e.kind} {JSON.stringify(e.data)}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
