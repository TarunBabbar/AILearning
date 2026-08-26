import { getConfig } from '../shared/lib/config.ts';
import { listSampleScreenIds } from '../agents/design-extraction/sample.ts';
import { Orchestrator } from '../agents/orchestrator/index.ts';
import { log } from '../shared/lib/logger.ts';

/**
 * Registers the bundled sample screens in the state store so
 * `npm run pipeline:a -- --screen login --sample` works out of the box.
 */
const cfg = getConfig();
const orch = Orchestrator.open(cfg);
try {
  for (const id of listSampleScreenIds()) {
    orch.registerScreen(id, `${id[0].toUpperCase()}${id.slice(1)} (sample)`, 'v1.0');
    log.info('setup:sample', `registered screen "${id}" (design-only)`);
  }
  console.log('Sample screens registered. Next:');
  console.log('  npm run pipeline:a -- --screen login --sample');
  console.log('  npm run pipeline:b -- --screen checkout --sample');
  console.log('  npm run status');
} finally {
  orch.getStore().close();
}
