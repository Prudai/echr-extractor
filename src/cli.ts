import { Command } from "commander";
import { SingleBar, Presets } from "cli-progress";
import {
  getEchr,
  getEchrExtra,
  getNodesEdges,
  getEchrSegments,
} from "./echr.js";

const program = new Command();
program
  .name("echr-extractor")
  .description(
    "Extract ECHR case metadata, full text, citation networks, and structured segments from HUDOC.",
  )
  .version("0.1.0");

program
  .command("extract")
  .description("Fetch case metadata and save it as CSV.")
  .option("--start-id <int>", "Index to start from", (v) => parseInt(v, 10), 0)
  .option("--end-id <int>", "Index to stop at", (v) => parseInt(v, 10))
  .option("--count <int>", "Number of records to fetch", (v) => parseInt(v, 10))
  .option("--start-date <date>", "Inclusive start date YYYY-MM-DD")
  .option("--end-date <date>", "Inclusive end date YYYY-MM-DD")
  .option(
    "--language <codes...>",
    "Language codes (space separated)",
    ["ENG"],
  )
  .option("--out-dir <path>", "Output directory", "data")
  .option("--no-save", "Do not write a CSV file")
  .option("--verbose", "Print progress to stderr", false)
  .option("--progress", "Show a CLI progress bar", false)
  .action(async (opts) => {
    const bar = opts.progress ? new SingleBar({}, Presets.shades_classic) : null;
    bar?.start(0, 0);
    await getEchr({
      startId: opts.startId,
      endId: opts.endId ?? null,
      count: opts.count,
      startDate: opts.startDate,
      endDate: opts.endDate,
      language: opts.language,
      saveFile: opts.save,
      outDir: opts.outDir,
      verbose: opts.verbose,
      logger: opts.progress ? null : undefined,
    });
    bar?.stop();
  });

program
  .command("extract-full")
  .description("Fetch metadata plus full-text content; save CSV and JSON.")
  .option("--start-id <int>", "Index to start from", (v) => parseInt(v, 10), 0)
  .option("--end-id <int>", "Index to stop at", (v) => parseInt(v, 10))
  .option("--count <int>", "Number of records to fetch", (v) => parseInt(v, 10))
  .option("--start-date <date>", "Inclusive start date YYYY-MM-DD")
  .option("--end-date <date>", "Inclusive end date YYYY-MM-DD")
  .option(
    "--language <codes...>",
    "Language codes (space separated)",
    ["ENG"],
  )
  .option("--threads <int>", "Concurrent downloads", (v) => parseInt(v, 10), 10)
  .option("--out-dir <path>", "Output directory", "data")
  .option("--no-save", "Do not write any output files")
  .option("--verbose", "Print progress to stderr", false)
  .action(async (opts) => {
    await getEchrExtra({
      startId: opts.startId,
      endId: opts.endId ?? null,
      count: opts.count,
      startDate: opts.startDate,
      endDate: opts.endDate,
      language: opts.language,
      threads: opts.threads,
      saveFile: opts.save,
      outDir: opts.outDir,
      verbose: opts.verbose,
    });
  });

program
  .command("network")
  .description("Build a citation network from a metadata file.")
  .requiredOption("--metadata-path <path>", "Path to a CSV or JSON metadata file")
  .option("--out-dir <path>", "Output directory", "data")
  .option("--no-save", "Do not write output files")
  .action(async (opts) => {
    await getNodesEdges({
      metadataPath: opts.metadataPath,
      saveFile: opts.save,
      outDir: opts.outDir,
    });
  });

program
  .command("segment")
  .description("Segment full-text judgments into structured legal sections.")
  .requiredOption("--metadata-path <path>", "Path to metadata CSV/JSON")
  .requiredOption("--fulltext-path <path>", "Path to full-text JSON")
  .option(
    "--allowed-langs <codes...>",
    "Languages to process",
    ["ENG", "FRE"],
  )
  .option(
    "--min-segment-length <int>",
    "Minimum chars per section",
    (v) => parseInt(v, 10),
    50,
  )
  .option("--out-dir <path>", "Output directory", "data")
  .option("--no-save", "Do not write output files")
  .action(async (opts) => {
    const { readFile } = await import("node:fs/promises");
    const md = await readFile(opts.metadataPath, "utf8");
    const ft = await readFile(opts.fulltextPath, "utf8");
    const cases = opts.metadataPath.endsWith(".json")
      ? JSON.parse(md)
      : parseCsvSimple(md);
    const fullTexts = JSON.parse(ft);
    await getEchrSegments({
      cases,
      fullTexts,
      allowedLangs: opts.allowedLangs,
      minSegmentLength: opts.minSegmentLength,
      saveFile: opts.save,
      outDir: opts.outDir,
    });
  });

function parseCsvSimple(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0]!.split(",");
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
