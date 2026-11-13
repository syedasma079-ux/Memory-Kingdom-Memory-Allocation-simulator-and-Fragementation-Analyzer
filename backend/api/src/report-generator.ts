import { Session } from './session-manager.js';
import { EngineSnapshot } from './types.js';

export function generateReport(session: Session, snapshot: EngineSnapshot, format: 'json' | 'md' | 'csv' = 'json'): string {
  const assumptions = [
    { id: 'ASM-1', rule: 'Demotion trigger', value: session.config.demotionTrigger, status: 'UNVERIFIED' },
    { id: 'ASM-2', rule: 'Admission ordering', value: session.config.admissionOrdering, status: 'UNVERIFIED' },
    { id: 'ASM-3', rule: 'Tick-boundary order', value: 'release -> arrival -> admit -> dispatch', status: 'UNVERIFIED' },
    { id: 'ASM-4', rule: 'Retry rule', value: 'retry on release or head change', status: 'UNVERIFIED' },
    { id: 'ASM-5', rule: 'Queue behavior', value: 'FIFO in Q, demote to next Q tail', status: 'UNVERIFIED' },
    { id: 'ASM-6', rule: 'Idle handling', value: 'clock advances 1 tick per step', status: 'UNVERIFIED' },
    { id: 'ASM-7', rule: 'State mapping', value: 'READY = admitted, SUSPENDED = demoted', status: 'UNVERIFIED' },
    { id: 'ASM-8', rule: 'Next Fit pointer rule', value: 'moves to remainder or following block', status: 'UNVERIFIED' },
    { id: 'ASM-9', rule: 'Search steps', value: 'blocks examined including allocated', status: 'UNVERIFIED' },
    { id: 'ASM-10', rule: 'Tie breaking', value: 'lowest offset, never exit early', status: 'UNVERIFIED' },
    { id: 'ASM-11', rule: 'Release timing', value: 'released at end of final slice (t + quantum)', status: 'UNVERIFIED' },
    { id: 'ASM-12', rule: 'Resource columns', value: 'parsed and displayed, unconstrained', status: 'UNVERIFIED' }
  ];

  if (format === 'json') {
    return JSON.stringify({
      sessionId: session.id,
      config: session.config,
      assumptions,
      snapshot,
      eventCount: session.events.length,
      events: session.events
    }, null, 2);
  }

  if (format === 'csv') {
    const lines: string[] = [];
    lines.push('Category,Key,Value');
    lines.push(`Config,Policy,${session.config.policy}`);
    lines.push(`Config,Quantum,${session.config.quantum}`);
    lines.push(`Config,TotalMemory,${session.config.totalMemory}`);
    lines.push(`Stats,CurrentTick,${snapshot.t}`);
    lines.push(`Stats,AllocatedMB,${snapshot.arena.statistics.allocated}`);
    lines.push(`Stats,FreeMB,${snapshot.arena.statistics.free}`);
    lines.push(`Stats,UtilizationPct,${snapshot.arena.statistics.utilization}`);
    lines.push(`Stats,ExternalFragmentationPct,${snapshot.arena.statistics.externalFragmentation}`);
    lines.push(`Stats,InternalFragmentationMB,${snapshot.arena.statistics.internalFragmentation ?? 0}`);
    lines.push(`Stats,AllocationEfficiencyPct,${snapshot.arena.statistics.allocationEfficiency ?? 100}`);
    lines.push(`Stats,LargestFreeMB,${snapshot.arena.statistics.largestFree}`);
    lines.push(`Stats,TotalSearchSteps,${snapshot.arena.statistics.searchSteps}`);
    return lines.join('\n');
  }

  // Markdown format
  let md = `# MEMORY KINGDOM Simulation Report\n\n`;
  md += `**Session ID**: \`${session.id}\`  \n`;
  md += `**Policy**: \`${session.config.policy}\` | **Quantum**: \`${session.config.quantum}\` | **Total Memory**: \`${session.config.totalMemory} MB\`\n\n`;
  md += `## Memory Arena Final Statistics\n\n`;
  md += `- **Current Time**: Tick ${snapshot.t}\n`;
  md += `- **Allocated**: ${snapshot.arena.statistics.allocated} MB (${snapshot.arena.statistics.utilization.toFixed(2)}% utilization)\n`;
  md += `- **Free**: ${snapshot.arena.statistics.free} MB (Largest Free: ${snapshot.arena.statistics.largestFree} MB)\n`;
  md += `- **External Fragmentation**: ${snapshot.arena.statistics.externalFragmentation.toFixed(2)}%\n`;
  md += `- **Internal Fragmentation**: ${snapshot.arena.statistics.internalFragmentation ?? 0} MB (Unused space inside allocated blocks)\n`;
  md += `- **Allocation Efficiency**: ${(snapshot.arena.statistics.allocationEfficiency ?? 100).toFixed(2)}%\n`;
  md += `- **Dragon Power**: ${snapshot.arena.statistics.dragonPower.toFixed(2)}% (Tier ${snapshot.arena.statistics.dragonTier})\n`;
  md += `- **Total Search Steps**: ${snapshot.arena.statistics.searchSteps}\n\n`;
  md += `## Assumptions Verification Register\n\n`;
  md += `| ID | Rule | Configured Value | Status |\n`;
  md += `|---|---|---|---|\n`;
  for (const a of assumptions) {
    md += `| ${a.id} | ${a.rule} | ${a.value} | **${a.status}** |\n`;
  }
  return md;
}

