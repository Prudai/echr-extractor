import type { EchrCase, EchrFullText, Logger } from "../types.js";
import { HUDOC_DOCUMENT_URL } from "../hudoc/fields.js";
import { extractFullText } from "./parser.js";
import { withRetry } from "../utils/retry.js";

export interface DownloadFullTextOptions {
  /** Concurrent download workers. Default 10. */
  threads?: number;
  /** Per-document timeout in ms. Default 60_000. */
  timeoutMs?: number;
  retryAttempts?: number;
  logger?: Logger;
  fetchImpl?: typeof fetch;
  onProgress?: (info: { done: number; total: number; itemId: string }) => void;
}

/**
 * Download and parse the full text for each case. Cases without an `itemid`
 * are skipped silently. Failed downloads are logged but do not abort the run.
 */
export async function downloadFullText(
  cases: ReadonlyArray<EchrCase>,
  opts: DownloadFullTextOptions = {},
): Promise<EchrFullText[]> {
  const {
    threads = 10,
    timeoutMs = 60_000,
    retryAttempts = 1,
    logger,
    fetchImpl = fetch,
    onProgress,
  } = opts;

  const targets: Array<{ itemId: string; ecli: string | undefined }> = [];
  for (const c of cases) {
    const itemId = typeof c.itemid === "string" ? c.itemid : "";
    if (!itemId) continue;
    targets.push({
      itemId,
      ecli: typeof c.ecli === "string" ? c.ecli : undefined,
    });
  }

  const results: EchrFullText[] = [];
  let cursor = 0;
  let done = 0;

  const total = targets.length;

  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= total) return;
      const target = targets[idx]!;
      try {
        const fullText = await withRetry(
          () => fetchHtmlAsText(target.itemId, timeoutMs, fetchImpl),
          { retryAttempts, logger, label: `full text for ${target.itemId}` },
        );
        results.push({ itemId: target.itemId, ecli: target.ecli, fullText });
      } catch (err) {
        logger?.warn(
          `Failed to fetch full text for ${target.itemId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      } finally {
        done++;
        onProgress?.({ done, total, itemId: target.itemId });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(threads, Math.max(total, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

async function fetchHtmlAsText(
  itemId: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<string> {
  const url = HUDOC_DOCUMENT_URL(itemId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HUDOC returned ${res.status} for ${itemId}`);
    }
    const html = await res.text();
    return extractFullText(html);
  } finally {
    clearTimeout(timer);
  }
}
