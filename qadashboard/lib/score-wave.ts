export type ScoreMatchJob = {
  id: string;
  title: string;
  company: string;
  email?: string | null;
  location?: string | null;
  experience?: string | null;
  description?: string | null;
  status: string;
  score: number;
  strengths?: string | null;
  gaps?: string | null;
  emailSent?: boolean;
  originalId?: string;
};

export type ScoreProgress = {
  percent: number;
  completed: number;
  attempted: number;
  scored: number;
  strongMatches: number;
  parsed?: number;
  boardTotal?: number;
  /** Jobs already scored before this wave + completed in this wave. */
  processedTotal?: number;
  /** Strong matches already saved + found in this wave. */
  strongTotal?: number;
  etaSeconds?: number;
  etaLabel?: string;
  phase?: string;
  message: string;
  ticker: string;
  detail?: string;
  modelCount?: number;
  jobsPerModel?: number;
  model?: string;
};

export type ScoreWaveResult = {
  ok: boolean;
  scored: number;
  attempted: number;
  strongMatches: number;
  scoredCount?: number;
  strongCount?: number;
  boardTotal?: number;
  message: string;
  error?: string;
};

const CLIENT_TICKERS = [
  "Dispatching jobs across free models…",
  "Checking jobs against your profile…",
  "Parsing job descriptions…",
  "Scoring in parallel on multiple models…",
  "Saving strong matches (≥60%)…",
  "Comparing skills and experience…",
  "Still scoring across models…",
];

/**
 * POST /api/jobs/score and consume NDJSON live events.
 */
export async function runScoreWave(
  opts: {
    scope?: "unscored" | "all";
    search?: string;
    limit?: number;
    onProgress?: (p: ScoreProgress) => void;
    onMatch?: (job: ScoreMatchJob) => void;
  } = {}
): Promise<ScoreWaveResult> {
  const res = await fetch("/api/jobs/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: opts.scope ?? "unscored",
      search: opts.search,
      // omit limit → server uses models × 10 from LLM_MODELS_JSON
      ...(opts.limit != null ? { limit: opts.limit } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return {
      ok: false,
      scored: 0,
      attempted: 0,
      strongMatches: 0,
      message: data.error || "Scoring failed",
      error: data.error || "Scoring failed",
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tickerRot = 0;
  let lastProgress: ScoreProgress = {
    percent: 0,
    completed: 0,
    attempted: 0,
    scored: 0,
    strongMatches: 0,
    message: "Starting…",
    ticker: CLIENT_TICKERS[0],
  };

  // Client-side rotating ticker so copy keeps changing even between server events
  const rotateId = setInterval(() => {
    tickerRot = (tickerRot + 1) % CLIENT_TICKERS.length;
    opts.onProgress?.({
      ...lastProgress,
      ticker: CLIENT_TICKERS[tickerRot],
    });
  }, 2200);

  let last: ScoreWaveResult = {
    ok: true,
    scored: 0,
    attempted: 0,
    strongMatches: 0,
    message: "Scoring…",
  };

  const emitProgress = (partial: Partial<ScoreProgress> & { message?: string }) => {
    lastProgress = {
      ...lastProgress,
      ...partial,
      message: partial.message || lastProgress.message,
      ticker: partial.ticker || CLIENT_TICKERS[tickerRot],
    };
    opts.onProgress?.(lastProgress);
  };

  emitProgress({ percent: 1, message: "Starting live score…", ticker: CLIENT_TICKERS[0] });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        let evt: Record<string, unknown>;
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }

        if (evt.type === "status" || evt.type === "progress" || evt.type === "start") {
          emitProgress({
            percent: Number(evt.percent) || lastProgress.percent,
            completed: Number(evt.completed) || lastProgress.completed,
            attempted: Number(evt.attempted) || lastProgress.attempted,
            scored: Number(evt.scored) || lastProgress.scored,
            strongMatches: Number(evt.strongMatches) || lastProgress.strongMatches,
            parsed: evt.parsed != null ? Number(evt.parsed) : lastProgress.parsed,
            boardTotal: evt.boardTotal != null ? Number(evt.boardTotal) : lastProgress.boardTotal,
            processedTotal:
              evt.processedTotal != null ? Number(evt.processedTotal) : lastProgress.processedTotal,
            strongTotal:
              evt.strongTotal != null ? Number(evt.strongTotal) : lastProgress.strongTotal,
            etaSeconds: evt.etaSeconds != null ? Number(evt.etaSeconds) : lastProgress.etaSeconds,
            etaLabel: evt.etaLabel != null ? String(evt.etaLabel) : lastProgress.etaLabel,
            phase: evt.phase != null ? String(evt.phase) : lastProgress.phase,
            message: String(evt.message || lastProgress.message),
            ticker: String(evt.ticker || CLIENT_TICKERS[tickerRot]),
            detail: evt.detail != null ? String(evt.detail) : lastProgress.detail,
            modelCount: evt.modelCount != null ? Number(evt.modelCount) : lastProgress.modelCount,
            jobsPerModel:
              evt.jobsPerModel != null ? Number(evt.jobsPerModel) : lastProgress.jobsPerModel,
            model: evt.model != null ? String(evt.model) : lastProgress.model,
          });
        } else if (evt.type === "match" && evt.job && typeof evt.job === "object") {
          const job = evt.job as ScoreMatchJob;
          opts.onMatch?.(job);
          emitProgress({
            strongMatches: Number(evt.strongMatches) || lastProgress.strongMatches + 1,
            strongTotal:
              evt.strongTotal != null
                ? Number(evt.strongTotal)
                : (lastProgress.strongTotal ?? lastProgress.strongMatches) + 1,
            processedTotal:
              evt.processedTotal != null
                ? Number(evt.processedTotal)
                : lastProgress.processedTotal,
            boardTotal:
              evt.boardTotal != null ? Number(evt.boardTotal) : lastProgress.boardTotal,
            ticker: CLIENT_TICKERS[tickerRot],
          });
        } else if (evt.type === "done") {
          last = {
            ok: true,
            scored: Number(evt.scored) || 0,
            attempted: Number(evt.attempted) || 0,
            strongMatches: Number(evt.strongMatches) || 0,
            scoredCount: Number(evt.scoredCount) || undefined,
            strongCount: Number(evt.strongCount) || undefined,
            boardTotal: Number(evt.boardTotal) || undefined,
            message: String(evt.message || "Done"),
          };
          emitProgress({
            percent: 100,
            completed: last.attempted,
            attempted: last.attempted,
            scored: last.scored,
            strongMatches: last.strongMatches,
            boardTotal: last.boardTotal,
            processedTotal:
              evt.processedTotal != null
                ? Number(evt.processedTotal)
                : Number(evt.scoredCount) || lastProgress.processedTotal,
            strongTotal:
              evt.strongTotal != null
                ? Number(evt.strongTotal)
                : Number(evt.strongCount) || lastProgress.strongTotal,
            message: last.message,
            ticker: String(evt.ticker || "Wave complete"),
            detail: evt.detail != null ? String(evt.detail) : undefined,
          });
        } else if (evt.type === "error") {
          last = {
            ok: false,
            scored: Number(evt.scored) || 0,
            attempted: Number(evt.attempted) || 0,
            strongMatches: lastProgress.strongMatches,
            scoredCount: Number(evt.scoredCount) || undefined,
            strongCount: Number(evt.strongCount) || undefined,
            boardTotal: Number(evt.boardTotal) || undefined,
            message: String(evt.error || "Scoring failed"),
            error: String(evt.error || "Scoring failed"),
          };
        }
      }
    }
  } finally {
    clearInterval(rotateId);
  }

  return last;
}
