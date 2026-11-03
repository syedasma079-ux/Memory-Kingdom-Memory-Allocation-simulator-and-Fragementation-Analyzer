import { describe, expect, it } from 'vitest';
import { eventToClip } from './eventClips';
import { ORACLE_EVENT_KINDS } from '../oracle/templates';

describe('eventToClip', () => {
  it('maps every known kind exhaustively', () => {
    for (const kind of ORACLE_EVENT_KINDS) {
      expect(eventToClip(kind)).not.toBe('unknown');
    }
  });

  it('collapses to instant under reduced motion', () => {
    expect(eventToClip('process_admitted', true)).toBe('instant');
    expect(eventToClip('memory_released', true)).toBe('instant');
  });
});
