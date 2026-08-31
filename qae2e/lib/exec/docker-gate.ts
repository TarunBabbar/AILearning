// Docker readiness gate.
//
// Before the pipeline runs the generated tests it needs a test executor:
// either a local Docker engine or a configured remote runner. If neither is
// available, the pipeline pauses and asks the user to start Docker, polls until
// it detects it, and only then continues. If Docker never comes up within
// WAIT_MS (15 minutes), the run is marked "stuck" instead of silently failing.

import { hasDocker } from "./index";
import { remoteRunnerConfigured } from "./remote";

export const DOCKER_WAIT_MS = 15 * 60 * 1000; // 15 minutes
export const DOCKER_POLL_MS = 10 * 1000; // check every 10s

export type DockerGateResult = "ready" | "stuck" | "aborted";

/**
 * Wait for a test executor (local Docker or a remote runner) to become
 * available. `emitLog` is called with human-readable status lines so the UI
 * live log shows what's happening.
 *
 * - "ready"   → Docker (or a remote runner) is available; continue.
 * - "stuck"   → nothing became available within the timeout; mark run stuck.
 * - "aborted" → the pipeline was stopped by the user.
 */
export async function waitForDockerExecutor(
  emitLog: (line: string) => void,
  isAborted: () => boolean,
  waitMs = DOCKER_WAIT_MS
): Promise<DockerGateResult> {
  // Remote runner configured → no local Docker needed.
  if (remoteRunnerConfigured()) {
    emitLog("Test executor detected: remote runner configured (TEST_RUNNER_URL). Proceeding to run tests…");
    return "ready";
  }

  if (await hasDocker()) {
    emitLog("Docker engine detected — proceeding to run tests.");
    return "ready";
  }

  emitLog(
    "Docker is required to run the generated tests, but the Docker engine is not running. " +
      "Please start Docker Desktop (or the Docker engine on this machine) and keep it running — " +
      "the pipeline will detect it automatically and continue. Waiting up to 15 minutes…"
  );

  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    if (isAborted()) return "aborted";
    await new Promise((r) => setTimeout(r, DOCKER_POLL_MS));
    if (isAborted()) return "aborted";
    if (await hasDocker()) {
      emitLog("Docker engine detected — resuming the test run.");
      return "ready";
    }
  }

  emitLog(
    "Timed out waiting for Docker after 15 minutes. The pipeline could not run the tests and has been marked as STUCK — " +
      "resume the pipeline once Docker is available."
  );
  return "stuck";
}
