import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Read an NDJSON response body and invoke `onEvent` per parsed line.
 * Returns the controller so callers can abort.
 */
export function readNdjsonStream(
  res: Response,
  onEvent: (ev: unknown) => void,
  signal?: AbortSignal
): { controller: AbortController } {
  const controller = new AbortController();
  const body = res.body;
  if (!body) return { controller };
  (async () => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        // Stop reading if the caller aborted (Stop button).
        if (signal?.aborted || controller.signal.aborted) break;
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
    } catch {
      // aborted or stream error — stop silently
    } finally {
      reader.releaseLock();
    }
  })();
  return { controller };
}
