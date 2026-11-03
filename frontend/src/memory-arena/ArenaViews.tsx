import { useMemo, useState } from 'react';
import { layoutBlocks } from './layoutBlocks';
import { useSimStore } from '../store/simStore';
import { cn } from '../lib/cn';

function getDecorationGlyph(offset: number, size: number, allocated: boolean): string {
  const hash = ((offset * 2654435761) ^ (size * 2246822519)) >>> 0;
  if (allocated) {
    const allocIcons = ['🏰', '🏘️', '🚩', '🛖'];
    return allocIcons[hash % allocIcons.length];
  } else {
    const freeIcons = ['🌲', '🌿', '🌾', '🪨', '🌸'];
    return freeIcons[hash % freeIcons.length];
  }
}

export function RealmMap() {
  const snap = useSimStore((s) => s.getSnapshot());
  const selected = useSimStore((s) => s.selectedBlockIndex);
  const setSelected = useSimStore((s) => s.setSelectedBlock);

  const territories = useMemo(() => {
    if (!snap) return [];
    return layoutBlocks(snap.arena.blocks, snap.arena.total, {
      rows: 8,
      rowSize: 128,
      cellW: 2,
      cellH: 24
    });
  }, [snap]);

  if (!snap) return <p className="text-sm text-stone-2">No snapshot yet.</p>;

  const width = 128 * 2;
  const height = 8 * 24;
  const nextFit = snap.arena.nextFitOffset;

  return (
    <div className="space-y-3" data-testid="realm-map">
      <div
        className="relative border-2 border-ink-3 bg-ink-0"
        style={{ width, height }}
        role="img"
        aria-label="Memory realm map: free grasslands and allocated territories"
      >
        {territories.map((t) =>
          t.rects.map((r, i) => (
            <button
              key={`${t.blockIndex}-${i}`}
              type="button"
              title={`offset ${t.offset} size ${t.size}`}
              data-testid={`territory-${t.blockIndex}`}
              className={cn(
                'absolute border text-[8px] text-left',
                t.allocated
                  ? 'hatch-alloc border-water-2 bg-water-1/80 text-water-3'
                  : 'hatch-free border-grass-2 bg-grass-1/80 text-grass-3',
                selected === t.blockIndex && 'ring-2 ring-gold-2'
              )}
              style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
              onClick={() => setSelected(t.blockIndex)}
            >
              {t.size >= 8 ? (
                <span className="p-0.5 flex items-center gap-0.5">
                  <span className="text-[9px]">{getDecorationGlyph(t.offset, t.size, t.allocated)}</span>
                  <span>{t.allocated ? `P${t.pid}` : 'free'} {t.size}</span>
                </span>
              ) : null}
            </button>
          ))
        )}
        {/* Next Fit marker */}
        <div
          className="pointer-events-none absolute top-0 h-full w-0.5 bg-gold-2"
          style={{ left: (nextFit % 128) * 2 }}
          data-testid="nextfit-marker-world"
          title={`Next Fit pointer @ ${nextFit}`}
        />
      </div>
      {territories.some((t) => t.size < 8) && (
        <p className="text-[10px] text-stone-2">Callouts for blocks under 8 MB are not to scale.</p>
      )}
      {selected !== null && snap.arena.blocks[selected] && (
        <BlockDetail
          index={selected}
          block={snap.arena.blocks[selected]}
          nextFit={nextFit}
          prev={selected > 0 ? snap.arena.blocks[selected - 1] : null}
          next={selected < snap.arena.blocks.length - 1 ? snap.arena.blocks[selected + 1] : null}
        />
      )}
    </div>
  );
}

function BlockDetail({
  index,
  block,
  nextFit,
  prev,
  next
}: {
  index: number;
  block: { offset: number; size: number; allocated: boolean; pid: number };
  nextFit: number;
  prev: { offset: number } | null;
  next: { offset: number } | null;
}) {
  return (
    <div className="panel p-3 font-mono text-xs" data-testid="block-detail">
      <p>index {index}</p>
      <p>offset {block.offset}</p>
      <p>end {block.offset + block.size} (exclusive)</p>
      <p>size {block.size} MB</p>
      <p>status {block.allocated ? 'allocated' : 'free'}</p>
      <p>PID {block.pid}</p>
      <p>prev {prev ? prev.offset : 'null'}</p>
      <p>next {next ? next.offset : 'null'}</p>
      <p>Next Fit marker {nextFit}</p>
    </div>
  );
}

export function TechnicalView() {
  const snap = useSimStore((s) => s.getSnapshot());
  if (!snap) return <p className="text-sm text-stone-2">No snapshot yet.</p>;

  const total = snap.arena.total;
  const nextFit = snap.arena.nextFitOffset;

  return (
    <div className="space-y-4" data-testid="technical-view">
      <div className="relative h-10 w-full border-2 border-ink-3 bg-ink-0" aria-label="Offset ruler">
        {snap.arena.blocks.map((b, i) => (
          <div
            key={i}
            className={cn(
              'absolute top-0 h-full border-r border-ink-2 text-[9px]',
              b.allocated ? 'bg-water-1 hatch-alloc' : 'bg-grass-1 hatch-free'
            )}
            style={{ left: `${(b.offset / total) * 100}%`, width: `${(b.size / total) * 100}%` }}
            title={`${b.offset}+${b.size}`}
          />
        ))}
        <div
          className="absolute top-0 h-full w-0.5 bg-gold-2"
          style={{ left: `${(nextFit / total) * 100}%` }}
          data-testid="nextfit-marker-tech"
        />
        <div className="absolute -bottom-5 left-0 text-[10px]">0</div>
        <div className="absolute -bottom-5 right-0 text-[10px]">{total}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs" data-testid="block-table">
          <thead>
            <tr className="border-b border-ink-3 text-stone-2">
              <th className="p-1">index</th>
              <th className="p-1">offset</th>
              <th className="p-1">end</th>
              <th className="p-1">size</th>
              <th className="p-1">status</th>
              <th className="p-1">PID</th>
            </tr>
          </thead>
          <tbody>
            {snap.arena.blocks.map((b, i) => (
              <tr key={i} className="border-b border-ink-2/50" data-testid={`block-row-${i}`}>
                <td className="p-1">{i}</td>
                <td className="p-1">{b.offset}</td>
                <td className="p-1">{b.offset + b.size}</td>
                <td className="p-1">{b.size}</td>
                <td className="p-1">{b.allocated ? 'TRUE' : 'FALSE'}</td>
                <td className="p-1">{b.pid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="linked-list-diagram" aria-label="Linked list">
        {snap.arena.blocks.map((b, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className={cn(
                'border-2 px-2 py-1 font-mono text-[10px]',
                b.allocated ? 'border-water-2 bg-water-0' : 'border-grass-2 bg-grass-0'
              )}
            >
              [{b.offset}|{b.size}|{b.allocated ? 'A' : 'F'}]
            </div>
            {i < snap.arena.blocks.length - 1 && <span aria-hidden>→</span>}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gold-2">Next Fit pointer @ offset {nextFit}</p>
    </div>
  );
}

export function SandboxControls() {
  const sendCommand = useSimStore((s) => s.sendCommand);
  const [size, setSize] = useState(100);
  const [offset, setOffset] = useState(0);
  const [msg, setMsg] = useState('');

  const alloc = async () => {
    try {
      const data = (await sendCommand({ cmd: 'arena.alloc', size, pid: 99 })) as {
        offset: number;
        size: number;
      };
      setMsg(`Allocated ${data.size} MB at offset ${data.offset} (engine)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const free = async () => {
    try {
      await sendCommand({ cmd: 'arena.free', offset });
      setMsg(`Freed offset ${offset} (engine)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="panel space-y-2 p-3" data-testid="sandbox-controls">
      <p className="font-pixel text-[9px] text-gold-2">Sandbox</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px]">
          Alloc size
          <input
            data-testid="sandbox-size"
            className="ml-2 border border-ink-3 bg-ink-0 px-2 py-1"
            type="number"
            min={1}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn" data-testid="sandbox-alloc" onClick={() => void alloc()}>
          arena.alloc
        </button>
        <label className="text-[11px]">
          Free offset
          <input
            data-testid="sandbox-offset"
            className="ml-2 border border-ink-3 bg-ink-0 px-2 py-1"
            type="number"
            min={0}
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn btn-danger" data-testid="sandbox-free" onClick={() => void free()}>
          arena.free
        </button>
      </div>
      {msg && (
        <p className="font-mono text-[11px] text-stone-2" data-testid="sandbox-msg">
          {msg}
        </p>
      )}
    </div>
  );
}
