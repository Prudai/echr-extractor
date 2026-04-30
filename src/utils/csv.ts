/**
 * Minimal RFC-4180 CSV writer. Rows are objects; the column set is the union
 * of all keys across rows (or `columns` if provided), with values stringified.
 */
export function toCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns?: ReadonlyArray<string>,
): string {
  const cols = columns ?? collectColumns(rows);
  const header = cols.map(escape).join(",");
  const body = rows
    .map((row) => cols.map((c) => escape(stringify(row[c]))).join(","))
    .join("\n");
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

function collectColumns(rows: ReadonlyArray<Record<string, unknown>>): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  return Array.from(seen);
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function escape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
