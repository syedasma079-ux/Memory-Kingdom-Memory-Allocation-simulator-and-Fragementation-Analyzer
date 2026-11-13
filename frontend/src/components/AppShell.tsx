import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TimeControls } from './TimeControls';
import { Oracle } from './Oracle';
import { CustomWorkloadBuilder } from './CustomWorkloadBuilder';
import { useSimStore } from '../store/simStore';

export function AppShell({ children }: { children: ReactNode }) {
  const error = useSimStore((s) => s.error);
  const highContrast = useSimStore((s) => s.highContrast);
  const cursor = useSimStore((s) => s.cursor);
  const snapshots = useSimStore((s) => s.snapshots);
  const activeWorkload = useSimStore((s) => s.activeWorkload);
  const loadAssignment = useSimStore((s) => s.loadAssignment);
  const openCustomWorkload = useSimStore((s) => s.openCustomWorkload);
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
        {!activeWorkload && (
          <div
            className="panel mx-4 mt-3 border-2 border-gold-2/60 bg-ink-1/95 p-4 text-center space-y-2 shadow-lg"
            data-testid="no-active-dataset-card"
          >
            <p className="font-pixel text-xs text-gold-2">No Active Dataset</p>
            <p className="font-mono text-xs text-stone-3" data-testid="no-active-dataset-message">
              No active dataset. Create a new dataset or load the assignment dataset to begin.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button
                type="button"
                className="btn text-xs"
                onClick={() => void loadAssignment()}
                data-testid="empty-load-assignment"
              >
                Load Assignment Dataset
              </button>
              <button
                type="button"
                className="btn border-gold-2 text-gold-2 hover:bg-gold-2/20 text-xs"
                onClick={openCustomWorkload}
                data-testid="empty-create-dataset"
              >
                Create Dataset
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-auto p-4">{children}</main>
        <Oracle />
        <CustomWorkloadBuilder />
      </div>
    </div>
  );
}
