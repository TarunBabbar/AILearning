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
import { EvalClient, isPassing, logEval } from '../agents/evaluation/client.ts';
import { readTestCaseFile } from '../agents/test-case-gen/agent.ts';
import { approvedCases, isFullyApproved, listPendingCases, summarize } from './approval.ts';
import { writeJson, exists, readJson, readText } from '../shared/lib/fs.ts';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export type Pipeline = 'a' | 'b';

export interface RunOptions {
  screenId: string;
  sample?: boolean;
  skipEvalGate?: boolean;
}

function openStore(cfg: Config): Orchestrator {
  return Orchestrator.open(cfg);
}

function runTsc(): { ok: boolean; output: string } {
  try {
    const out = execSync('npx tsc --noEmit', { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf-8', timeout: 120_000 });
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, output: (err as { stdout?: string }).stdout ?? String(err) };
  }
}

export async function runPipeline(pipeline: Pipeline, opts: RunOptions): Promise<void> {
  const cfg: Config = getConfig({ mode: opts.sample ? 'sample' : getConfig().mode });
  const screenId = opts.screenId;
  const orch = openStore(cfg);
  const evalClient = new EvalClient(cfg);

  try {
    if (pipeline === 'a') await pipelineA(cfg, orch, evalClient, screenId, opts);
    else await pipelineB(cfg, orch, evalClient, screenId, opts);
  } finally {
    orch.getStore().close();
  }
}

/* ---------------- Pipeline A — Regression Validation ---------------- */

async function pipelineA(cfg: Config, orch: Orchestrator, evalClient: EvalClient, screenId: string, opts: RunOptions): Promise<void> {
  log.info('pipeline:a', `starting regression validation for "${screenId}"`);

  // 1. Design extraction
  orch.transition(screenId, 'design-extracted', 'pipeline:a');
  const figma = new FigmaRestProvider(cfg);
  const designAgent = new DesignExtractionAgent(cfg, figma);
  const designRes = await designAgent.run(screenId);
  const designSpecPath = `${cfg.specsDir}/design/${screenId}.design-spec.json`;
  writeJson(designSpecPath, designRes.spec);
  orch.logRun({ screenId, agent: 'design-extraction', status: 'success', artifactPath: designSpecPath, message: `provider=${designRes.provider} elements=${designRes.spec.elements.length}` });

  // 2. Impl inspection
  const implAgent = new ImplementationInspectorAgent(cfg);
  const implRes = await implAgent.run(screenId);
  const implSpecPath = `${cfg.specsDir}/impl/${screenId}.impl-spec.json`;
  writeJson(implSpecPath, implRes.spec);
  orch.transition(screenId, 'impl-inspected', 'pipeline:a');
  orch.logRun({ screenId, agent: 'impl-inspector', status: 'success', artifactPath: implSpecPath, message: `provider=${implRes.provider} elements=${implRes.spec.elements.length}` });

  // 3. Validation / diff
  const validation = new ValidationAgent(cfg);
  const report = await validation.run(designRes.spec, implRes.spec);
  const reportPath = saveDriftReport(cfg, report);
  orch.logRun({ screenId, agent: 'validation', status: 'success', artifactPath: reportPath, message: `verdict=${report.summary.verdict} deltas=${report.summary.totalDeltas}` });

  // 4. Eval gate (drift report quality)
  if (!opts.skipEvalGate) {
    const driftEval = await evalClient.evaluateDrift({
      screenId,
      reportSummary: `verdict=${report.summary.verdict}, deltas=${report.summary.totalDeltas} (${report.summary.critical} critical, ${report.summary.major} major)`,
      deltas: report.deltas,
    });
    logEval('pipeline:a', driftEval);
    if (!isPassing(driftEval) && !cfg.dryRun) {
      orch.transition(screenId, 'eval-failed', 'pipeline:a');
      orch.logRun({ screenId, agent: 'evaluation', status: 'failed', message: `drift eval ${driftEval.verdict} (${driftEval.score})` });
      console.log(`\n[EVAL GATE] drift report scored ${driftEval.verdict} (${driftEval.score}) — see ${reportPath}`);
      return;
    }
    orch.logRun({ screenId, agent: 'evaluation', status: 'success', message: `drift eval ${driftEval.verdict} (${driftEval.score})` });
  }

  orch.transition(screenId, 'validated', 'pipeline:a');
  console.log(`\n[PIPELINE A] "${screenId}" validated. Verdict: ${report.summary.verdict} (${report.summary.totalDeltas} deltas). Report: ${reportPath}`);
  if (report.judgment?.verdict && report.judgment.verdict !== report.summary.verdict) {
    console.log(`  LLM vision judgment: ${report.judgment.verdict} — ${report.judgment.summary}`);
  }
}

/* ---------------- Pipeline B — Shift-Left ---------------- */

async function pipelineB(cfg: Config, orch: Orchestrator, evalClient: EvalClient, screenId: string, opts: RunOptions): Promise<void> {
  log.info('pipeline:b', `starting shift-left for "${screenId}"`);

  // 1. Design extraction
  orch.transition(screenId, 'design-extracted', 'pipeline:b');
  const figma = new FigmaRestProvider(cfg);
  const designAgent = new DesignExtractionAgent(cfg, figma);
  const designRes = await designAgent.run(screenId);
  const designSpecPath = `${cfg.specsDir}/design/${screenId}.design-spec.json`;
  writeJson(designSpecPath, designRes.spec);
  orch.logRun({ screenId, agent: 'design-extraction', status: 'success', artifactPath: designSpecPath });

  // 2. Test case generation
  const context = loadContext(cfg, screenId);
  const testGen = new TestCaseGenAgent(cfg);
  const tests = await testGen.run(designRes.spec, context);
  orch.transition(screenId, 'tests-generated', 'pipeline:b');
  orch.logRun({ screenId, agent: 'test-case-gen', status: 'success', artifactPath: `${cfg.specsDir}/tests/${screenId}.tests.yaml`, message: `${tests.cases.length} cases via ${tests.provider}` });

  // 3. Eval gate (faithfulness of test cases to the design spec)
  if (!opts.skipEvalGate) {
    const sourceText = [
      `Screen: ${designRes.spec.screen.name}`,
      designRes.spec.elements.map((e) => `[${e.id}] ${e.name} (${e.role})${e.text ? ` "${e.text}"` : ''}`).join('\n'),
    ].join('\n');
    const testEval = await evalClient.evaluateTestCases({
      screenId,
      sourceText,
      cases: tests.cases.map((c) => ({ id: c.id, title: c.title, scenario: c.scenario, expected: c.expected })),
    });
    logEval('pipeline:b', testEval);
    if (!isPassing(testEval) && !cfg.dryRun) {
      orch.transition(screenId, 'eval-failed', 'pipeline:b');
      orch.logRun({ screenId, agent: 'evaluation', status: 'failed', message: `test-case faithfulness ${testEval.overall.verdict}` });
      console.log(`\n[EVAL GATE] test cases scored ${testEval.overall.faithfulness} — fix before approval.`);
      return;
    }
    orch.logRun({ screenId, agent: 'evaluation', status: 'success', message: `faithfulness ${testEval.overall.verdict} (${testEval.overall.faithfulness})` });
  }

  // 4. Human approval gate
  const summary = summarize(tests);
  console.log(`\n[REVIEW GATE] ${summary.total} test cases generated for "${screenId}" — ${summary.approved} approved, ${summary.pending} pending.`);
  if (summary.approved === 0) {
    console.log('  Run: node scripts/review.ts list ' + screenId);
    console.log('  Then: node scripts/review.ts approve-all ' + screenId);
    console.log('  Then re-run: npm run pipeline:b -- --screen ' + screenId + (opts.sample ? ' --sample' : ''));
    if (cfg.dryRun) {
      console.log('  (dry-run: auto-approving to continue)');
    } else {
      return;
    }
  }

  const testFile = readTestCaseFile(`${cfg.specsDir}/tests/${screenId}.tests.yaml`);
  const ready = isFullyApproved(testFile);
  if (ready) orch.transition(screenId, 'tests-approved', 'pipeline:b');

  // 5. Automation codegen
  if (ready || cfg.dryRun) {
    const codegen = new AutomationCodegenAgent(cfg);
    const genRes = await codegen.run(testFile, designRes.spec);

    // 6. Compile gate
    const tsc = runTsc();
    if (!tsc.ok && !cfg.dryRun) {
      orch.transition(screenId, 'eval-failed', 'pipeline:b');
      orch.logRun({ screenId, agent: 'automation-codegen', status: 'failed', message: 'generated spec failed tsc --noEmit' });
      console.log(`\n[COMPILE GATE] generated spec failed tsc:\n${tsc.output.slice(0, 1500)}`);
      return;
    }
    orch.logRun({ screenId, agent: 'automation-codegen', status: 'success', artifactPath: genRes.files[0], message: `provider=${genRes.provider}` });
    orch.transition(screenId, 'automation-generated', 'pipeline:b');
    console.log(`\n[CODEGEN] wrote ${genRes.files[0]} (${genRes.provider}). tsc ${tsc.ok ? 'passed' : 'skipped (dry-run)'}`);
    if (cfg.dryRun) {
      orch.transition(screenId, 'pending-dev', 'pipeline:b');
      console.log('  Status: pending-dev — tests ready to run the moment the screen ships.');
    }
  } else {
    console.log('\n[BLOCKED] tests not fully approved — approve then re-run.');
  }
}

function loadContext(cfg: Config, screenId: string): string | undefined {
  const p = `${cfg.screensDir}/${screenId}/context.md`;
  return exists(p) ? readText(p) : undefined;
}

/* ---------------- CLI ---------------- */

const HELP = `Figma → Playwright pipeline runner.

Usage:
  npm run pipeline:a -- --screen <id> [--sample] [--skip-eval-gate]
  npm run pipeline:b -- --screen <id> [--sample] [--skip-eval-gate]

Examples:
  npm run pipeline:a -- --screen login --sample
  npm run pipeline:b -- --screen checkout --sample
  npm run pipeline:a -- --screen login          # live (needs .env)
`;

function parseArgs(argv: string[]): RunOptions & { pipeline?: Pipeline } {
  const opts: RunOptions & { pipeline?: Pipeline } = { screenId: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === 'a' || a === 'b') opts.pipeline = a;
    else if (a === '--screen') opts.screenId = argv[++i] ?? '';
    else if (a === '--sample') opts.sample = true;
    else if (a === '--skip-eval-gate') opts.skipEvalGate = true;
  }
  return opts;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.pipeline) return void console.log(HELP);
  if (!args.screenId) return void console.log('Missing --screen <id>. ' + HELP);
  const cfg = getConfig();
  const orch = openStore(cfg);
  try {
    if (!orch.getScreen(args.screenId)) {
      orch.registerScreen(args.screenId, args.screenId);
      console.log(`Registered new screen "${args.screenId}" in state store.`);
    }
  } finally {
    orch.getStore().close();
  }
  await runPipeline(args.pipeline, args);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    log.error('pipeline', (err as Error).stack ?? String(err));
    process.exit(1);
  });
}
