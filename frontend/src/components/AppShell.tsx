import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TimeControls } from './TimeControls';
import { Oracle } from './Oracle';
import { useSimStore } from '../store/simStore';

export function AppShell({ children }: { children: ReactNode }) {
  const error = useSimStore((s) => s.error);
  const highContrast = useSimStore((s) => s.highContrast);
  const cursor = useSimStore((s) => s.cursor);
  const snapshots = useSimStore((s) => s.snapshots);
  const historyMode = cursor >= 0 && snapshots.length > 0 && cursor < snapshots.length - 1;

  return (
    <div
      className={`flex min-h-screen ${highContrast ? 'contrast-125' : ''}`}
      data-testid="app-shell"
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TimeControls />
        {historyMode && (
          <div className="bg-gold-0 px-3 py-1 text-center text-[10px] text-gold-3" role="status">
            History view (read-only inspection of recorded snapshots)
          </div>
        )}
        {error && (
          <div className="bg-ember-0 px-3 py-1 text-[11px] text-ember-3" role="alert" data-testid="error-banner">
            {error}
          </div>
        )}
        <main className="flex-1 overflow-auto p-4">{children}</main>
        <Oracle />
      </div>
    </div>
  );
}
