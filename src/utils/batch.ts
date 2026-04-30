/**
 * Split a [start, end] inclusive date range into windows of `daysPerBatch` days.
 * Dates are ISO strings (YYYY-MM-DD).
 */
export function splitDateRange(
  start: string,
  end: string,
  daysPerBatch: number,
): Array<{ start: string; end: string }> {
  if (daysPerBatch <= 0) {
    throw new Error("daysPerBatch must be positive");
  }
  const startMs = parseIsoDate(start).getTime();
  const endMs = parseIsoDate(end).getTime();
  if (endMs < startMs) {
    throw new Error(`end (${end}) is before start (${start})`);
  }
  const windowMs = daysPerBatch * 24 * 60 * 60 * 1000;
  const out: Array<{ start: string; end: string }> = [];
  for (let cursor = startMs; cursor <= endMs; cursor += windowMs) {
    const windowEnd = Math.min(cursor + windowMs - 86_400_000, endMs);
    out.push({ start: toIsoDate(cursor), end: toIsoDate(windowEnd) });
  }
  return out;
}

function parseIsoDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date (expected YYYY-MM-DD): ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toIsoDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
