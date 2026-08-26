import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import { paths } from './paths';

export interface RunRequest {
  kind: 'pipeline' | 'agent';
  pipeline?: 'a' | 'b';
  agent?: 'design' | 'inspect' | 'validate' | 'testgen' | 'codegen' | 'eval';
  screenId: string;
  sample?: boolean;
  skipEvalGate?: boolean;
}

export interface ActiveRun {
  id: string;
  request: RunRequest;
  child: ChildProcess;
  startedAt: number;
  finished: boolean;
  exitCode: number | null;
  lines: string[];
  listeners: Set<(chunk: string) => void>;
}

const runs = new Map<string, ActiveRun>();

export function buildCommand(req: RunRequest): { file: string; args: string[] } {
  const args: string[] = ['--experimental-strip-types'];
  if (req.kind === 'pipeline') {
    args.push(paths.runPipelineCli, req.pipeline ?? 'a', '--screen', req.screenId);
    if (req.sample) args.push('--sample');
    if (req.skipEvalGate) args.push('--skip-eval-gate');
  } else {
    args.push(paths.agentRunCli, req.agent ?? 'design', '--screen', req.screenId);
    if (req.sample) args.push('--sample');
  }
  return { file: process.execPath, args };
}

export function startRun(req: RunRequest): ActiveRun {
  const id = crypto.randomUUID();
  const { file, args } = buildCommand(req);

  const child = spawn(file, args, {
    cwd: paths.repoRoot,
    env: { ...process.env },
  });

  const run: ActiveRun = {
    id,
    request: req,
    child,
    startedAt: Date.now(),
    finished: false,
    exitCode: null,
    lines: [],
    listeners: new Set(),
  };

  const emit = (chunk: string) => {
    run.lines.push(chunk);
    for (const l of run.listeners) l(chunk);
  };

  child.stdout.on('data', (d: Buffer) => emit(d.toString()));
  child.stderr.on('data', (d: Buffer) => emit(d.toString()));
  child.on('error', (err) => emit(`[error] ${err.message}\n`));
  child.on('close', (code) => {
    run.finished = true;
    run.exitCode = code;
    emit(`[done] exit code ${code ?? 'null'}\n`);
  });

  runs.set(id, run);
  return run;
}

export function getRun(id: string): ActiveRun | undefined {
  return runs.get(id);
}

export function subscribe(run: ActiveRun, cb: (chunk: string) => void): () => void {
  run.listeners.add(cb);
  // replay buffered output so late joiners see history
  for (const line of run.lines) cb(line);
  return () => run.listeners.delete(cb);
}

export function listActiveRuns(): ActiveRun[] {
  return [...runs.values()];
}
