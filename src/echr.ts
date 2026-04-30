import { join } from "node:path";
import type {
  EchrCase,
  EchrCorpusRow,
  EchrEdge,
  EchrFullText,
  EchrMissingReference,
  EchrNode,
  EchrSegment,
  Logger,
} from "./types.js";
import { fetchMetadata, type FetchMetadataOptions } from "./hudoc/client.js";
import { downloadFullText, type DownloadFullTextOptions } from "./fulltext/downloader.js";
import { buildNodesEdges } from "./network/builder.js";
import { segmentEchrTexts, type SegmentOptions } from "./segments/segmenter.js";
import { determineFilename, writeCsv, writeJson } from "./io/save.js";
import { resolveLogger } from "./utils/logger.js";

export interface GetEchrOptions
  extends Omit<FetchMetadataOptions, "logger" | "fetchImpl" | "onProgress"> {
  /** Number of records to fetch (alternative to `endId`). */
  count?: number;
  /** Print progress info to stderr. Default false. */
  verbose?: boolean;
  /** Save results to `data/<auto-name>.csv`. Default true. */
  saveFile?: boolean;
  /** Output directory used when `saveFile` is true. Default `data`. */
  outDir?: string;
  /** Show a CLI progress bar. Default false. (Ignored if a logger is set.) */
  progressBar?: boolean;
  logger?: Logger | null;
  fetchImpl?: typeof fetch;
}

export interface GetEchrExtraResult {
  metadata: EchrCase[];
  fullTexts: EchrFullText[];
}

export interface GetEchrExtraOptions extends GetEchrOptions {
  /** Concurrent download workers for the full-text phase. Default 10. */
  threads?: number;
}

/**
 * Fetch ECHR case metadata from HUDOC.
 *
 * Mirrors the upstream Python `get_echr` API: paginated metadata fetch with
 * date-window batching, exponential-backoff retries, and optional CSV save.
 */
export async function getEchr(opts: GetEchrOptions = {}): Promise<EchrCase[]> {
  const {
    count,
    verbose = false,
    saveFile = true,
    outDir = "data",
    logger: rawLogger,
    fetchImpl,
    startId = 0,
    endId: rawEndId = null,
    ...rest
  } = opts;

  const logger = resolveLogger(rawLogger, verbose);
  const endId = count !== undefined ? startId + count : rawEndId;

  logger.info(
    count !== undefined
      ? `Starting ECHR download for ${count} records`
      : "Starting ECHR download",
  );

  const cases = await fetchMetadata({
    ...rest,
    startId,
    endId,
    logger,
    fetchImpl,
    onProgress: ({ fetched, total }) =>
      logger.info(
        `Progress: ${fetched}${total !== null ? `/${total}` : ""} cases fetched`,
      ),
  });

  if (saveFile) {
    const filename = determineFilename(startId, endId, opts.startDate, opts.endDate);
    await writeCsv(join(outDir, `${filename}.csv`), cases);
    logger.info(`Saved metadata to ${join(outDir, `${filename}.csv`)}`);
  }
  logger.info("Done");
  return cases;
}

/**
 * Fetch metadata plus full-text content for each case.
 *
 * Returns both the metadata array and a separate list of `{ itemId, ecli,
 * fullText }` records. When `saveFile` is true, writes both a CSV and a JSON
 * file under `outDir`.
 */
export async function getEchrExtra(
  opts: GetEchrExtraOptions = {},
): Promise<GetEchrExtraResult> {
  const {
    threads = 10,
    saveFile = true,
    outDir = "data",
    verbose = false,
    logger: rawLogger,
    fetchImpl,
    ...rest
  } = opts;
  const logger = resolveLogger(rawLogger, verbose);

  const metadata = await getEchr({
    ...rest,
    saveFile: false,
    verbose,
    logger,
    fetchImpl,
  });

  logger.info(`Beginning full-text download (${metadata.length} cases, ${threads} threads)`);
  const fullTexts = await downloadFullText(metadata, {
    threads,
    logger,
    fetchImpl,
    onProgress: ({ done, total }) =>
      logger.debug(`Full text: ${done}/${total}`),
  });
  logger.info("Full-text download finished");

  if (saveFile) {
    const filename = determineFilename(
      rest.startId ?? 0,
      rest.endId ?? null,
      rest.startDate,
      rest.endDate,
    );
    const ftFilename = filename.replace("metadata", "full_text");
    await writeCsv(join(outDir, `${filename}.csv`), metadata);
    await writeJson(join(outDir, `${ftFilename}.json`), fullTexts);
  }
  return { metadata, fullTexts };
}

export interface GetNodesEdgesOptions {
  /** Pre-fetched cases. Either this or `metadataPath` must be provided. */
  cases?: ReadonlyArray<EchrCase>;
  /** Path to a CSV/JSON file produced by `getEchr` / `getEchrExtra`. */
  metadataPath?: string;
  saveFile?: boolean;
  outDir?: string;
}

export interface GetNodesEdgesResult {
  nodes: EchrNode[];
  edges: EchrEdge[];
  missingReferences: EchrMissingReference[];
}

export async function getNodesEdges(
  opts: GetNodesEdgesOptions,
): Promise<GetNodesEdgesResult> {
  const { cases, metadataPath, saveFile = true, outDir = "data" } = opts;
  let source: ReadonlyArray<EchrCase>;
  if (cases) {
    source = cases;
  } else if (metadataPath) {
    source = await loadMetadata(metadataPath);
  } else {
    throw new Error("Provide either `cases` or `metadataPath`");
  }

  const result = buildNodesEdges(source);

  if (saveFile) {
    await writeCsv(
      join(outDir, "ECHR_nodes.csv"),
      result.nodes as unknown as Record<string, unknown>[],
    );
    await writeCsv(
      join(outDir, "ECHR_edges.csv"),
      result.edges as unknown as Record<string, unknown>[],
    );
    await writeJson(join(outDir, "ECHR_nodes.json"), result.nodes);
    await writeJson(join(outDir, "ECHR_edges.json"), result.edges);
    if (result.missingReferences.length > 0) {
      await writeCsv(
        join(outDir, "ECHR_missing_references.csv"),
        result.missingReferences as unknown as Record<string, unknown>[],
      );
    }
  }
  return result;
}

export interface GetEchrSegmentsOptions extends SegmentOptions {
  /** Metadata DataFrame-equivalent. Combine with `fullTexts`. */
  cases?: ReadonlyArray<EchrCase>;
  /** Output of `getEchrExtra().fullTexts`. */
  fullTexts?: ReadonlyArray<EchrFullText>;
  /** Pre-merged corpus, where each row already has a `fullText` field. */
  corpus?: ReadonlyArray<EchrCorpusRow>;
  saveFile?: boolean;
  outDir?: string;
}

export async function getEchrSegments(
  opts: GetEchrSegmentsOptions,
): Promise<EchrSegment[]> {
  const { cases, fullTexts, corpus, saveFile = true, outDir = "data", ...rest } = opts;

  let input: ReadonlyArray<EchrCorpusRow>;
  if (corpus) {
    input = corpus;
  } else if (cases && fullTexts) {
    input = mergeCorpus(cases, fullTexts);
  } else {
    throw new Error("Provide either `corpus`, or both `cases` and `fullTexts`");
  }

  const result = segmentEchrTexts(input, rest);
  if (saveFile) {
    await writeCsv(
      join(outDir, "echr_segments.csv"),
      result as unknown as Record<string, unknown>[],
    );
  }
  return result;
}

/**
 * Merge metadata rows with full-text rows on `itemid`. Equivalent to the
 * Python `prepare_echr_corpus` helper.
 */
export function mergeCorpus(
  cases: ReadonlyArray<EchrCase>,
  fullTexts: ReadonlyArray<EchrFullText>,
): EchrCorpusRow[] {
  const ftIndex = new Map<string, string>();
  for (const ft of fullTexts) ftIndex.set(ft.itemId, ft.fullText);
  return cases.map((c) => ({
    ...c,
    fullText: typeof c.itemid === "string" ? ftIndex.get(c.itemid) : undefined,
  }));
}

async function loadMetadata(path: string): Promise<EchrCase[]> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(path, "utf8");
  if (path.endsWith(".json")) return JSON.parse(raw) as EchrCase[];
  return parseCsv(raw);
}

function parseCsv(text: string): EchrCase[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]!);
  const rows: EchrCase[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row as EchrCase);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
