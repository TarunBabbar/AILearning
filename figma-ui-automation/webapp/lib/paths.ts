import path from 'node:path';
import fs from 'node:fs';

/**
 * Repo root = parent of the webapp folder.
 * Under Next (Turbopack/webpack) `__dirname` is not reliable, so we resolve from
 * process.cwd() when running inside the Next server, falling back to __dirname.
 */
function resolveRepoRoot(): string {
  // Next dev/start runs with cwd = the webapp directory
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'next.config.ts'))) return path.resolve(cwd, '..');
  // Fallback: compiled module location (webapp/.next/server/... → up 3)
  return path.resolve(__dirname, '../../..');
}

export const REPO_ROOT = resolveRepoRoot();

export const paths = {
  repoRoot: REPO_ROOT,
  envFile: path.join(REPO_ROOT, '.env'),
  envExample: path.join(REPO_ROOT, '.env.example'),
  dbFile: path.join(REPO_ROOT, 'data', 'orchestrator.db'),
  specsDir: path.join(REPO_ROOT, 'specs'),
  designSpecs: path.join(REPO_ROOT, 'specs', 'design'),
  implSpecs: path.join(REPO_ROOT, 'specs', 'impl'),
  testCases: path.join(REPO_ROOT, 'specs', 'tests'),
  driftReports: path.join(REPO_ROOT, 'reports', 'drift'),
  evalReports: path.join(REPO_ROOT, 'reports'),
  generatedSpecs: path.join(REPO_ROOT, 'tests', 'generated'),
  screensDir: path.join(REPO_ROOT, 'agents', 'screens'),
  artifactsDir: path.join(REPO_ROOT, 'artifacts'),
  runPipelineCli: path.join(REPO_ROOT, 'scripts', 'run-pipeline.ts'),
  agentRunCli: path.join(REPO_ROOT, 'scripts', 'agent-run.ts'),
  reviewCli: path.join(REPO_ROOT, 'scripts', 'review.ts'),
};
