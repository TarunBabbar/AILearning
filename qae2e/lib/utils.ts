import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Read an NDJSON response body and invoke `onEvent` per parsed line.
 * Returns a Promise that resolves when the stream ends (or aborts).
 * IMPORTANT: callers must await this — otherwise UI "running" flips false early.
 */
export async function readNdjsonStream(
  res: Response,
  onEvent: (ev: unknown) => void,
  signal?: AbortSignal
): Promise<void> {
  const body = res.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => {
    try {
      reader.cancel().catch(() => undefined);
    } catch {
      // ignore
    }
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          onEvent(JSON.parse(line));
        } catch {
          // skip malformed line
        }
      }
    }
    // Flush trailing line if present
    if (buffer.trim()) {
      try {
        onEvent(JSON.parse(buffer));
      } catch {
        // ignore
      }
    }
  } catch {
    // aborted or stream error
  } finally {
    signal?.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // already released
    }
  }
}
