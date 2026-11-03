import { describe, expect, it } from 'vitest';
import { ORACLE_EVENT_KINDS, renderOracle } from './templates';
import type { EngineEvent } from '../types/engine';

function ev(kind: string, data: Record<string, unknown>, t = 7): EngineEvent {
  return { type: 'event', seq: 1, t, kind, data };
}

describe('Oracle templates', () => {
  it('covers every registered event kind with real numbers', () => {
    for (const kind of ORACLE_EVENT_KINDS) {
      const text = renderOracle(
        ev(kind, {
          pid: 6,
          memMb: 108,
          size: 108,
          offset: 0,
          policy: 'first_fit',
          name: 'P6',
          remaining: 2,
          queueLevel: 1,
          reason: 'NO_CONTIGUOUS_BLOCK',
          from: 'q1',
          to: 'q2',
          allocSize: 108,
          remainSize: 84,
          steps: 3,
          chosenOffset: 0,
          arrival: 7,
          cpuBurst: 2
        })
      );
      expect(text.length).toBeGreaterThan(10);
      expect(text).toMatch(/t=7/);
    }
  });

  it('embeds First Fit admission numbers from the event', () => {
    const text = renderOracle(
      ev('process_admitted', { pid: 6, offset: 0, size: 108, policy: 'first_fit' })
    );
    expect(text).toContain('P6');
    expect(text).toContain('108');
    expect(text).toContain('offset 0');
    expect(text).toContain('First Fit');
  });
});
