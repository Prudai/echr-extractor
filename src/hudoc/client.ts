import type { EchrCase, Logger } from "../types.js";
import { withRetry } from "../utils/retry.js";
import { splitDateRange } from "../utils/batch.js";
import { buildQueryUrl } from "./query.js";
import { DEFAULT_FIELDS } from "./fields.js";

export interface FetchMetadataOptions {
  startId?: number;
  endId?: number | null;
  startDate?: string;
  endDate?: string;
  language?: ReadonlyArray<string>;
  fields?: ReadonlyArray<string>;
  /** Custom HUDOC `/app/query/results` URL — overrides built-in builders. */
  link?: string;
  /** Custom payload that replaces the default doctype filter. */
  queryPayload?: string;
  batchSize?: number;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
  retryAttempts?: number;
  /** Hard cap on attempts across all batches before aborting. */
  maxAttempts?: number;
  daysPerBatch?: number;
  /** Called after each batch completes with the running total. */
  onProgress?: (info: { fetched: number; total: number | null }) => void;
  logger?: Logger;
  /** Custom fetch — defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

interface HudocResponse {
  resultcount?: number;
  results?: Array<{ columns: Record<string, unknown> }>;
}

/**
 * Stream metadata from HUDOC, paginating with `start`/`length`. When a date
 * range is given and large, the range is split into windows of
 * `daysPerBatch` to keep individual queries fast.
 */
export async function fetchMetadata(
  opts: FetchMetadataOptions = {},
): Promise<EchrCase[]> {
  const {
    startId = 0,
    endId = null,
    startDate,
    endDate,
    language = ["ENG"],
    fields = DEFAULT_FIELDS,
    link,
    queryPayload,
    batchSize = 500,
    timeoutMs = 60_000,
    retryAttempts = 3,
    maxAttempts = 20,
    daysPerBatch = 365,
    onProgress,
    logger,
    fetchImpl = fetch,
  } = opts;

  if (batchSize <= 0 || batchSize > 500) {
    throw new Error("batchSize must be between 1 and 500");
  }

  const windows =
    startDate && endDate
      ? splitDateRange(startDate, endDate, daysPerBatch)
      : [{ start: startDate, end: endDate }];

  const all: EchrCase[] = [];
  let attempts = 0;

  for (const win of windows) {
    let cursor = startId;
    while (true) {
      if (endId !== null && cursor >= endId) break;
      if (attempts >= maxAttempts) {
        throw new Error(
          `Aborting after ${attempts} attempts (max_attempts=${maxAttempts})`,
        );
      }
      const length = endId !== null ? Math.min(batchSize, endId - cursor) : batchSize;
      const url =
        link ??
        buildQueryUrl({
          fields,
          language,
          startDate: win.start,
          endDate: win.end,
          queryPayload,
          start: cursor,
          length,
        });

      attempts++;
      logger?.debug(`GET ${url}`);
      const data = await withRetry(
        () => fetchJson<HudocResponse>(url, timeoutMs, fetchImpl),
        { retryAttempts, logger, label: "metadata fetch" },
      );

      const rows = (data.results ?? []).map((r) => r.columns as EchrCase);
      all.push(...rows);
      const totalAvailable = data.resultcount ?? null;
      onProgress?.({ fetched: all.length, total: totalAvailable });
      logger?.info(
        `Fetched ${rows.length} rows (running total: ${all.length}${
          totalAvailable !== null ? ` / ${totalAvailable}` : ""
        })`,
      );

      if (rows.length < length) break;
      cursor += rows.length;
      if (totalAvailable !== null && cursor >= totalAvailable) break;
    }
  }

  return all;
}

async function fetchJson<T>(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`HUDOC returned ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
