import type { Logger } from "../types.js";

export interface RetryOptions {
  retryAttempts: number;
  /** Cap on the backoff sleep, in milliseconds. Default 30_000. */
  maxBackoffMs?: number;
  logger?: Logger;
  /** Label included in log messages. */
  label?: string;
}

/**
 * Run `fn` with exponential backoff. Backoff is `2^attempt * 1000` ms,
 * capped at `maxBackoffMs` (default 30s) — same shape as the upstream
 * Python implementation.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { retryAttempts, maxBackoffMs = 30_000, logger, label = "request" } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retryAttempts) break;
      const backoff = Math.min(2 ** attempt * 1000, maxBackoffMs);
      logger?.warn(
        `${label} failed (attempt ${attempt + 1}/${retryAttempts + 1}): ${
          err instanceof Error ? err.message : String(err)
        }. Retrying in ${backoff}ms.`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`${label} failed: ${String(lastErr)}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
