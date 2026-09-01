// Docker readiness gate.
//
// Before the pipeline runs the generated tests it needs a test executor:
// either a local Docker engine or a configured remote runner.
//
// - Docker installed + daemon running  → ready, run tests.
// - Remote runner configured           → ready, run tests.
// - Docker installed but daemon OFF    → wait up to DOCKER_WAIT_MS for the user
//                                        to start it, then mark the run STUCK.
// - Docker NOT installed (serverless,  → skip immediately with a clear message
//   Vercel, no docker binary)            so the pipeline doesn't hang waiting
//                                        for something that can never appear.

import { hasDocker, dockerInstalled } from "./index";
import { remoteRunnerConfigured } from "./remote";

export const DOCKER_WAIT_MS = 15 * 60 * 1000; // 15 minutes
export const DOCKER_POLL_MS = 10 * 1000; // check every 10s

export type DockerGateResult = "ready" | "stuck" | "skipped" | "aborted";

/**
 * Determine whether the test run can proceed.
 * - "ready"   → Docker (or a remote runner) is available; continue.
 * - "skipped" → Docker is not installed here (serverless) and no remote runner
 *               is configured — tests cannot run; skip gracefully.
 * - "stuck"   → Docker is installed but was never started within the timeout.
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

  // Docker isn't installed at all (e.g. Vercel serverless): never wait — the
  // tests cannot run here, so report it and skip gracefully.
  const installed = await dockerInstalled();
  if (!installed) {
    emitLog(
      "Docker is not available in this environment and no remote runner is configured (TEST_RUNNER_URL). " +
        "The tests cannot run here — skipping the test run and continuing with what was generated. " +
        "To run the tests, deploy with a remote runner or run the pipeline on a machine with Docker."
    );
    return "skipped";
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
