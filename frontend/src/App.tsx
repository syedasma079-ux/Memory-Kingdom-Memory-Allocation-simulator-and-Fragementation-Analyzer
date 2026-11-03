import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { AlgorithmGuild } from './pages/AlgorithmGuild';
import { Chronicles } from './pages/Chronicles';
import { FeedbackCastle } from './pages/FeedbackCastle';
import { FragmentationDungeon } from './pages/FragmentationDungeon';
import { KingdomOverview } from './pages/KingdomOverview';
import { MemoryArena } from './pages/MemoryArena';
import { ProcessTavern } from './pages/ProcessTavern';
import { QuestBoard } from './pages/QuestBoard';
import { StrategyRoom } from './pages/StrategyRoom';
import { SystemSettings } from './pages/SystemSettings';
import { useSimStore } from './store/simStore';

export default function App() {
  const location = useSimStore((s) => s.location);
  const createSession = useSimStore((s) => s.createSession);
  const destroySession = useSimStore((s) => s.destroySession);
  const sessionId = useSimStore((s) => s.sessionId);

  useEffect(() => {
    void createSession().catch((err) => {
      console.error('Failed to create session', err);
    });
    return () => {
      void destroySession();
    };
  }, [createSession, destroySession]);

  let page;
  switch (location) {
    case 'overview':
      page = <KingdomOverview />;
      break;
    case 'arena':
      page = <MemoryArena />;
      break;
    case 'guild':
      page = <AlgorithmGuild />;
      break;
    case 'tavern':
      page = <ProcessTavern />;
      break;
    case 'castle':
      page = <FeedbackCastle />;
      break;
    case 'dungeon':
      page = <FragmentationDungeon />;
      break;
    case 'strategy':
      page = <StrategyRoom />;
      break;
    case 'quests':
      page = <QuestBoard />;
      break;
    case 'chronicles':
      page = <Chronicles />;
      break;
    case 'settings':
      page = <SystemSettings />;
      break;
    default:
      page = <KingdomOverview />;
  }

  return (
    <AppShell>
      <div data-testid="session-ready" data-session={sessionId ?? ''}>
        {page}
      </div>
    </AppShell>
  );
}
