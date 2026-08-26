import type { Config } from '../../shared/lib/config.ts';
import { StateStore, type ScreenState } from '../../shared/lib/state-store.ts';
import { log } from '../../shared/lib/logger.ts';

/** Allowed transitions for the rule-based state machine. */
export const TRANSITIONS: Record<ScreenState, ScreenState[]> = {
  'design-only': ['design-extracted'],
  'design-extracted': ['design-extracted', 'impl-inspected', 'tests-generated'], // re-runs
  'impl-inspected': ['validated', 'eval-failed'],
  validated: ['eval-failed', 'design-extracted', 'impl-inspected'], // re-runs
  'tests-generated': ['tests-generated', 'tests-approved', 'automation-generated', 'eval-failed', 'design-extracted'], // re-runs + dry-run auto-approve
  'tests-approved': ['automation-generated', 'eval-failed', 'tests-generated'],
  'automation-generated': ['pending-dev', 'eval-failed', 'automation-generated', 'design-extracted'], // re-runs
  'pending-dev': ['dev-shipped', 'automation-generated', 'design-extracted'], // re-runs
  'dev-shipped': ['validated', 'eval-failed', 'design-extracted'], // re-run after design change
  'eval-failed': ['design-extracted', 'tests-generated', 'tests-approved', 'automation-generated', 'dev-shipped'],
};

/**
 * Orchestrator — deterministic state machine + run log.
 * Never LLM-driven: it only advances a screen when the producing agent reports success
 * and the gate (schema / compile / eval) has passed.
 */
export class Orchestrator {
  private cfg: Config;
  private store: StateStore;

  constructor(cfg: Config, store: StateStore) {
    this.cfg = cfg;
    this.store = store;
  }

  static open(cfg: Config): Orchestrator {
    const store = new StateStore(`${cfg.dataDir}/orchestrator.db`);
    return new Orchestrator(cfg, store);
  }

  registerScreen(id: string, name: string, designVersion?: string, implUrl?: string): void {
    this.store.upsertScreen({ id, name, designVersion, implUrl });
  }

  getState(screenId: string): ScreenState {
    return this.store.getScreen(screenId)?.state ?? 'design-only';
  }

  /** Returns the new state after transition, or throws if the transition is not allowed. */
  transition(screenId: string, to: ScreenState, agent: string): ScreenState {
    const current = this.getState(screenId);
    const allowed = TRANSITIONS[current] ?? [];
    if (!allowed.includes(to)) {
      throw new Error(`Illegal transition for "${screenId}": ${current} → ${to} (allowed: ${allowed.join(', ') || 'none'})`);
    }
    log.info('orchestrator', `${screenId}: ${current} → ${to} (via ${agent})`);
    this.store.setState(screenId, to);
    return to;
  }

  logRun(args: { screenId: string; agent: string; status: 'success' | 'failed' | 'pending' | 'skipped'; artifactPath?: string | null; message?: string }): void {
    const id = `${args.agent}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.store.addRun({ id, ...args });
  }

  listScreens(): ReturnType<StateStore['listScreens']> {
    return this.store.listScreens();
  }

  getScreen(id: string): ReturnType<StateStore['getScreen']> {
    return this.store.getScreen(id);
  }

  listApprovals(screenId?: string): ReturnType<StateStore['listApprovals']> {
    return this.store.listApprovals(screenId);
  }

  listRuns(screenId?: string): ReturnType<StateStore['listRuns']> {
    return this.store.listRuns(screenId);
  }

  getStore(): StateStore {
    return this.store;
  }
}
