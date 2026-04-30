/**
 * Patterns and helpers for parsing case references out of HUDOC metadata.
 *
 * The two strongest reference signals on a case row are:
 *   - `extractedappno` / `appno`: comma-separated application numbers
 *   - `scl` ("Strasbourg case law"): semicolon-separated free-text citations
 *     containing case name, "EUR. COURT H.R." prefix, judgment date, etc.
 */

/** Application number form: `NNNN/YY` (1–6 digits / 2 digits). */
export const APP_NO_PATTERN = /\b\d{1,6}\/\d{2}\b/g;

/**
 * Tokens to strip from `scl` citations before name matching. Matches the
 * upstream Python `clean_pattern` list.
 */
export const CLEAN_PATTERNS: ReadonlyArray<RegExp> = [
  /EUR\.?\s*COURT\s*H\.?R\.?/gi,
  /JUDGMENT\s+OF.*$/i,
  /\sDU\s.*$/i,
];

export function extractAppNumbers(value: string | undefined | null): string[] {
  if (!value) return [];
  return value.match(APP_NO_PATTERN) ?? [];
}

/**
 * Split an `scl` field into individual citations. Citations are typically
 * separated by `;` but some cases use `|` or newlines.
 */
export function splitCitations(scl: string | undefined | null): string[] {
  if (!scl) return [];
  return scl
    .split(/[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normalize a case-name fragment for matching: strip noise patterns,
 * collapse whitespace and punctuation, lowercase.
 */
export function normalizeCaseName(text: string): string {
  let s = text;
  for (const re of CLEAN_PATTERNS) s = s.replace(re, " ");
  return s
    .replace(/\bv\.\b/gi, "v")
    .replace(/[.,()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
