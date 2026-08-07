export type LogLevel = "info" | "warn" | "error";

export type LogEvent = {
  ts: string;
  level: LogLevel;
  phase: string;
  message: string;
  detail?: string;
};

/**
 * Minimal structured logger for the upload pipeline.
 * - Logs to the server console (dev + prod) with phase prefixes.
 * - Optionally streams events to the client via an onEvent callback
 *   (used by the NDJSON progress stream).
 */
export function createLogger(onEvent?: (ev: LogEvent) => void) {
  function emit(level: LogLevel, phase: string, message: string, detail?: string) {
    const ev: LogEvent = {
      ts: new Date().toISOString(),
      level,
      phase,
      message,
      detail,
    };
    const line = `[${ev.ts}] [${ev.phase}] ${ev.message}${detail ? ` — ${detail}` : ""}`;
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    onEvent?.(ev);
  }

  return {
    info: (phase: string, message: string, detail?: string) =>
      emit("info", phase, message, detail),
    warn: (phase: string, message: string, detail?: string) =>
      emit("warn", phase, message, detail),
    error: (phase: string, message: string, detail?: string) =>
      emit("error", phase, message, detail),
  };
}

export type Logger = ReturnType<typeof createLogger>;

/** Small helper to format durations for logs. */
export function ms(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
