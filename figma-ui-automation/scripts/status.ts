import { getConfig } from '../shared/lib/config.ts';
import { Orchestrator } from '../agents/orchestrator/index.ts';

const cfg = getConfig();
const orch = Orchestrator.open(cfg);
try {
  const screens = orch.listScreens();
  if (screens.length === 0) {
    console.log('No screens registered yet. Run: npm run setup:sample  (or a pipeline with --sample)');
  }
  for (const s of screens) {
    console.log(`${s.id.padEnd(20)} ${s.state.padEnd(22)} ${s.name}${s.designVersion ? `  v${s.designVersion}` : ''}`);
    const runs = orch.listRuns(s.id);
    if (runs.length) {
      for (const r of runs.slice(0, 8)) {
        console.log(`  · ${r.agent.padEnd(20)} ${r.status.padEnd(8)} ${r.message ?? ''}`);
      }
    }
  }
  const approvals = orch.listApprovals();
  if (approvals.length) {
    console.log('\nApprovals:');
    for (const a of approvals.slice(0, 10)) console.log(`  · ${a.screenId}/${a.testCaseId} → ${a.decision}`);
  }
} finally {
  orch.getStore().close();
}
