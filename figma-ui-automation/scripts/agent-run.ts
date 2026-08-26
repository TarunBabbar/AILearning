import { getConfig, type Config } from '../shared/lib/config.ts';
import { log } from '../shared/lib/logger.ts';
import { Orchestrator } from '../agents/orchestrator/index.ts';
import { FigmaRestProvider } from '../agents/design-extraction/figma-client.ts';
import { DesignExtractionAgent } from '../agents/design-extraction/agent.ts';
import { ImplementationInspectorAgent } from '../agents/impl-inspector/agent.ts';
import { ValidationAgent } from '../agents/validation/agent.ts';
import { saveDriftReport } from '../agents/validation/report.ts';
import { TestCaseGenAgent } from '../agents/test-case-gen/agent.ts';
import { AutomationCodegenAgent } from '../agents/automation-codegen/agent.ts';
import { EvalClient } from '../agents/evaluation/client.ts';
import { writeJson, readJson } from '../shared/lib/fs.ts';

type AgentName = 'design' | 'inspect' | 'validate' | 'testgen' | 'codegen' | 'eval';

const HELP = `Run a single agent.

Usage:
  node scripts/agent-run.ts <agent> --screen <id> [--sample]

Agents:
  design     design-extraction   (Figma → design-spec.json)
  inspect    impl-inspector      (staging URL → impl-spec.json)
  validate   validation          (design+impl → drift report)
  testgen    test-case-gen       (design-spec → test-cases.yaml)
  codegen    automation-codegen  (approved cases → .spec.ts)
  eval       evaluation          (DeepEval sidecar / mock judge)
`;

function parseArgs(argv: string[]): { agent?: AgentName; screenId: string; sample?: boolean } {
  const opts: { agent?: AgentName; screenId: string; sample?: boolean } = { screenId: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['design', 'inspect', 'validate', 'testgen', 'codegen', 'eval'].includes(a)) opts.agent = a as AgentName;
    else if (a === '--screen') opts.screenId = argv[++i] ?? '';
    else if (a === '--sample') opts.sample = true;
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.agent) return void console.log(HELP);
  if (!opts.screenId) return void console.log('Missing --screen <id>. ' + HELP);

  const cfg: Config = getConfig({ mode: opts.sample ? 'sample' : getConfig().mode });
  const screenId = opts.screenId;
  const orch = Orchestrator.open(cfg);
  const evalClient = new EvalClient(cfg);

  try {
    switch (opts.agent) {
      case 'design': {
        const figma = new FigmaRestProvider(cfg);
        const res = await new DesignExtractionAgent(cfg, figma).run(screenId);
        const p = `${cfg.specsDir}/design/${screenId}.design-spec.json`;
        writeJson(p, res.spec);
        console.log(`design-spec: ${p} (provider=${res.provider}, elements=${res.spec.elements.length})`);
        orch.logRun({ screenId, agent: 'design-extraction', status: 'success', artifactPath: p });
        break;
      }
      case 'inspect': {
        const res = await new ImplementationInspectorAgent(cfg).run(screenId);
        const p = `${cfg.specsDir}/impl/${screenId}.impl-spec.json`;
        writeJson(p, res.spec);
        console.log(`impl-spec: ${p} (provider=${res.provider}, elements=${res.spec.elements.length})`);
        orch.logRun({ screenId, agent: 'impl-inspector', status: 'success', artifactPath: p });
        break;
      }
      case 'validate': {
        const design = readSpec(`${cfg.specsDir}/design/${screenId}.design-spec.json`);
        const impl = readSpec(`${cfg.specsDir}/impl/${screenId}.impl-spec.json`);
        const report = await new ValidationAgent(cfg).run(design as never, impl as never);
        const p = saveDriftReport(cfg, report);
        console.log(`drift report: ${p}`);
        console.log(`verdict=${report.summary.verdict} deltas=${report.summary.totalDeltas} pixelDiff=${(report.summary.pixelDiffRatio * 100).toFixed(2)}%`);
        orch.logRun({ screenId, agent: 'validation', status: 'success', artifactPath: p });
        break;
      }
      case 'testgen': {
        const design = readSpec(`${cfg.specsDir}/design/${screenId}.design-spec.json`);
        const tests = await new TestCaseGenAgent(cfg).run(design as never);
        console.log(`test cases: ${cfg.specsDir}/tests/${screenId}.tests.yaml (${tests.cases.length} cases via ${tests.provider})`);
        orch.logRun({ screenId, agent: 'test-case-gen', status: 'success' });
        break;
      }
      case 'codegen': {
        const { readTestCaseFile } = await import('../agents/test-case-gen/agent.ts');
        const tests = readTestCaseFile(`${cfg.specsDir}/tests/${screenId}.tests.yaml`);
        const design = readSpec(`${cfg.specsDir}/design/${screenId}.design-spec.json`);
        const res = await new AutomationCodegenAgent(cfg).run(tests, design as never);
        console.log(`generated: ${res.files.join(', ')} (${res.provider})`);
        orch.logRun({ screenId, agent: 'automation-codegen', status: 'success', artifactPath: res.files[0] });
        break;
      }
      case 'eval': {
        const verdict = await evalClient.evaluateDrift({ screenId, reportSummary: 'manual', deltas: [] });
        console.log(verdict);
        break;
      }
    }
  } finally {
    orch.getStore().close();
  }
}

function readSpec(p: string) {
  return readJson(p);
}

main().catch((err) => {
  log.error('agent-run', (err as Error).stack ?? String(err));
  process.exit(1);
});
