import { getConfig } from '../shared/lib/config.ts';
import { listSampleScreenIds } from '../agents/design-extraction/sample.ts';
import { Orchestrator } from '../agents/orchestrator/index.ts';

const cfg = getConfig();
const orch = Orchestrator.open(cfg);
try {
  console.log('Sample screens available in --sample mode:');
  for (const id of listSampleScreenIds()) {
    const s = orch.getScreen(id);
    console.log(`  · ${id.padEnd(10)} state=${s?.state ?? 'not-registered'}`);
  }
} finally {
  orch.getStore().close();
}
