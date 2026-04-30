import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { toCsv } from "../utils/csv.js";

/** Write a JSON file, creating parent directories as needed. */
export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Write rows to a CSV file, creating parent directories as needed. */
export async function writeCsv(
  path: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<string>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, toCsv(rows, columns), "utf8");
}

/**
 * Build a metadata filename matching the upstream Python convention
 * (used so the output layout is interchangeable with the Python tool).
 */
export function determineFilename(
  startId: number,
  endId: number | null,
  startDate: string | undefined,
  endDate: string | undefined,
): string {
  const idPart = endId !== null ? `${startId}-${endId}` : `${startId}-ALL`;
  const datePart =
    startDate && endDate
      ? `dates_${startDate}-${endDate}`
      : startDate
        ? `dates_${startDate}-END`
        : endDate
          ? `dates_START-${endDate}`
          : "dates_START-END";
  return `echr_metadata_${idPart}_${datePart}`;
}
