/**
 * Pure geometric transform: maps engine 1-D block offsets/sizes onto an 8×128 MB
 * realm grid. This is NOT an allocation algorithm — it only places shapes.
 */

export interface BlockInput {
  offset: number;
  size: number;
  allocated: boolean;
  pid?: number;
}

export interface LayoutRect {
  blockIndex: number;
  offset: number;
  size: number;
  allocated: boolean;
  pid: number;
  row: number;
  /** Inclusive start column within the row (0..rowSize-1), in MB cells. */
  colStart: number;
  /** Exclusive end column within the row. */
  colEnd: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Territory {
  blockIndex: number;
  offset: number;
  size: number;
  allocated: boolean;
  pid: number;
  rects: LayoutRect[];
}

export interface LayoutOptions {
  rows?: number;
  rowSize?: number;
  cellW?: number;
  cellH?: number;
}

const DEFAULT_ROWS = 8;
const DEFAULT_ROW_SIZE = 128;

export function layoutBlocks(
  blocks: BlockInput[],
  total: number,
  opts: LayoutOptions = {}
): Territory[] {
  const rows = opts.rows ?? DEFAULT_ROWS;
  const rowSize = opts.rowSize ?? DEFAULT_ROW_SIZE;
  const cellW = opts.cellW ?? 1;
  const cellH = opts.cellH ?? 1;

  if (total <= 0) return [];
  if (rows * rowSize !== total) {
    // Still layout using configured rowSize; leftover MB wraps into extra rows if needed.
  }

  const territories: Territory[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const b = blocks[blockIndex];
    const pid = b.pid ?? -1;
    const rects: LayoutRect[] = [];

    let remaining = b.size;
    let cursor = b.offset;

    while (remaining > 0) {
      const row = Math.floor(cursor / rowSize);
      const colStart = cursor % rowSize;
      const room = rowSize - colStart;
      const take = Math.min(room, remaining);
      const colEnd = colStart + take;

      rects.push({
        blockIndex,
        offset: b.offset,
        size: b.size,
        allocated: b.allocated,
        pid,
        row,
        colStart,
        colEnd,
        x: colStart * cellW,
        y: row * cellH,
        width: take * cellW,
        height: cellH
      });

      cursor += take;
      remaining -= take;

      if (row >= rows && remaining > 0) {
        // Extra rows beyond the nominal 8 are still emitted so geometry stays faithful.
      }
    }

    territories.push({
      blockIndex,
      offset: b.offset,
      size: b.size,
      allocated: b.allocated,
      pid,
      rects
    });
  }

  return territories;
}

/** Property helpers used by tests. */
export function territoryArea(t: Territory): number {
  return t.rects.reduce((sum, r) => sum + (r.colEnd - r.colStart), 0);
}

export function totalLaidOutArea(territories: Territory[]): number {
  return territories.reduce((sum, t) => sum + territoryArea(t), 0);
}

export function hasOverlappingCells(territories: Territory[]): boolean {
  const seen = new Set<string>();
  for (const t of territories) {
    for (const r of t.rects) {
      for (let c = r.colStart; c < r.colEnd; c++) {
        const key = `${r.row}:${c}`;
        if (seen.has(key)) return true;
        seen.add(key);
      }
    }
  }
  return false;
}
