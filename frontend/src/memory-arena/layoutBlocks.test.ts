import { describe, expect, it } from 'vitest';
import {
  hasOverlappingCells,
  layoutBlocks,
  totalLaidOutArea
} from './layoutBlocks';

const G1_BLOCKS = [
  { offset: 0, size: 192, allocated: false },
  { offset: 192, size: 32, allocated: true, pid: 1 },
  { offset: 224, size: 416, allocated: false },
  { offset: 640, size: 32, allocated: true, pid: 3 },
  { offset: 672, size: 160, allocated: false },
  { offset: 832, size: 128, allocated: true, pid: 5 },
  { offset: 960, size: 64, allocated: false }
];

describe('layoutBlocks', () => {
  it('areas sum to total and never overlap (G1 layout)', () => {
    const territories = layoutBlocks(G1_BLOCKS, 1024);
    expect(totalLaidOutArea(territories)).toBe(1024);
    expect(hasOverlappingCells(territories)).toBe(false);
  });

  it('maps as 8 provinces of 128 MB LTR then TTB', () => {
    const territories = layoutBlocks([{ offset: 0, size: 200, allocated: false }], 1024);
    expect(territories[0].rects).toHaveLength(2);
    expect(territories[0].rects[0]).toMatchObject({ row: 0, colStart: 0, colEnd: 128 });
    expect(territories[0].rects[1]).toMatchObject({ row: 1, colStart: 0, colEnd: 72 });
  });

  it('passthrough unusual offsets unchanged in geometry', () => {
    const territories = layoutBlocks(
      [
        { offset: 10, size: 5, allocated: true, pid: 99 },
        { offset: 15, size: 1009, allocated: false }
      ],
      1024
    );
    expect(territories[0].offset).toBe(10);
    expect(territories[0].size).toBe(5);
    expect(territories[0].pid).toBe(99);
    expect(totalLaidOutArea(territories)).toBe(1014);
  });
});
