export type ClipId =
  | 'instant'
  | 'arrive'
  | 'search-admit'
  | 'dispatch'
  | 'demote'
  | 'terminate'
  | 'release-merge'
  | 'alloc-fail'
  | 'idle'
  | 'finish'
  | 'suspend'
  | 'resume'
  | 'queue-move'
  | 'split'
  | 'merge'
  | 'search'
  | 'unknown';

/**
 * Exhaustive event→clip mapping. Animation clips never own state; they only
 * describe how to present an engine event. Reduced motion collapses to instant.
 */
export function eventToClip(kind: string, reducedMotion = false): ClipId {
  if (reducedMotion) return 'instant';

  switch (kind) {
    case 'process_arrived':
      return 'arrive';
    case 'process_admitted':
      return 'search-admit';
    case 'process_dispatched':
      return 'dispatch';
    case 'process_demoted':
      return 'demote';
    case 'process_terminated':
      return 'terminate';
    case 'memory_released':
      return 'release-merge';
    case 'alloc_failed':
      return 'alloc-fail';
    case 'idle':
      return 'idle';
    case 'sim_finished':
      return 'finish';
    case 'process_suspended':
      return 'suspend';
    case 'process_resumed':
      return 'resume';
    case 'queue_moved':
      return 'queue-move';
    case 'block_split':
      return 'split';
    case 'block_merged':
      return 'merge';
    case 'search_trace':
      return 'search';
    default:
      return 'unknown';
  }
}

export function isExhaustiveKind(kind: string): boolean {
  return eventToClip(kind) !== 'unknown';
}
