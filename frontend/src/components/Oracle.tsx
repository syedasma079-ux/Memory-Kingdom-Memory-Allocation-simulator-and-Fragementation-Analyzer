import { useSimStore } from '../store/simStore';

export function Oracle() {
  const message = useSimStore((s) => s.oracleMessage);

  return (
    <aside
      className="panel mx-3 mb-3 mt-2 min-h-[64px] p-3"
      data-testid="oracle"
      aria-label="Memory Oracle"
    >
      <p className="font-pixel text-[9px] text-magic-1">Memory Oracle</p>
      <p className="mt-2 font-mono text-xs text-stone-3" aria-live="polite" data-testid="oracle-message">
        {message}
      </p>
    </aside>
  );
}
