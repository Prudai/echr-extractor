import { DEFAULT_FIELDS, HUDOC_BASE_URL } from "./fields.js";

export interface BuildQueryUrlOptions {
  fields?: ReadonlyArray<string>;
  language?: ReadonlyArray<string>;
  /** Inclusive ISO date (YYYY-MM-DD). */
  startDate?: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  endDate?: string;
  /** Custom search payload — replaces the default doctype filter. */
  queryPayload?: string;
  start: number;
  length: number;
}

const DEFAULT_DOCTYPE_FILTER =
  "contentsitename:ECHR AND (NOT (doctype=PR OR doctype=HFCOMOLD OR doctype=HECOMOLD))";

/**
 * Build a HUDOC `/app/query/results` URL.
 *
 * Mirrors the upstream Python `determine_meta_url`: a base filter excluding
 * old commission/press doctypes, plus optional language, date, and custom
 * payload constraints, plus the SharePoint-style `select` field list.
 */
export function buildQueryUrl(opts: BuildQueryUrlOptions): string {
  const fields = opts.fields ?? DEFAULT_FIELDS;
  const language = opts.language ?? ["ENG"];

  const clauses: string[] = [];
  clauses.push(opts.queryPayload ?? DEFAULT_DOCTYPE_FILTER);

  if (language.length) {
    const langExpr = language.map((l) => `languageisocode="${l}"`).join(" OR ");
    clauses.push(`(${langExpr})`);
  }

  if (opts.startDate || opts.endDate) {
    const lo = opts.startDate ? `"${opts.startDate}"` : '"1900-01-01"';
    const hi = opts.endDate ? `"${opts.endDate}"` : `"${todayIso()}"`;
    clauses.push(`(kpdate>=${lo} AND kpdate<=${hi})`);
  }

  const query = clauses.join(" AND ");
  const url = new URL(`${HUDOC_BASE_URL}/app/query/results`);
  url.searchParams.set("query", query);
  url.searchParams.set("select", fields.join(","));
  url.searchParams.set("sort", "itemid Ascending");
  url.searchParams.set("start", String(opts.start));
  url.searchParams.set("length", String(opts.length));
  return url.toString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Convert a HUDOC web-UI deeplink (the kind users copy from the HUDOC search
 * page) into a query API URL. Mirrors the Python `link_to_query` function.
 *
 * The web URL contains a JSON-ish query object after a `#{...}` fragment.
 * This function extracts that object, decodes URL escapes, and rebuilds the
 * equivalent server-side query string.
 */
export function linkToQuery(link: string): string {
  let s = link
    .replaceAll("%7B", "{")
    .replaceAll("%7D", "}")
    .replaceAll("%5B", "[")
    .replaceAll("%5D", "]")
    .replaceAll("%22", '"')
    .replaceAll("%27", "'");

  // The fulltext field contains user-entered queries with embedded quotes
  // that confuse JSON parsing — extract it first, then strip from the link.
  let fullTextInput = "";
  const fulltextStart = s.indexOf("fulltext");
  if (fulltextStart !== -1) {
    const open = s.indexOf("[", fulltextStart);
    const close = s.indexOf("]", fulltextStart);
    if (open !== -1 && close !== -1 && close > open) {
      const inner = s.slice(open + 1, close);
      // Drop enclosing quotes if present, escape backslashes, wrap.
      const stripped = inner.replace(/^"|"$/g, "").replace(/\\/g, "");
      fullTextInput = `(${stripped})`;
      const endIdx = s[close + 1] === "," ? close + 2 : close + 1;
      const toReplace = s.slice(fulltextStart - 1, endIdx);
      s = s.replace(toReplace, "");
    }
  }

  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  if (objStart === -1 || objEnd === -1 || objEnd <= objStart) {
    throw new Error("HUDOC link does not contain a query object");
  }
  const jsonRaw = decodeURIComponent(s.slice(objStart, objEnd + 1)).replace(
    /'/g,
    '"',
  );

  let parsed: Record<string, string[]>;
  try {
    parsed = JSON.parse(jsonRaw);
  } catch {
    parsed = lenientParse(jsonRaw);
  }

  const advancedMap: Record<string, string> = {
    bodyprocedure: '("PROCEDURE" ONEAR(n=1000) terms OR "PROCÉDURE" ONEAR(n=1000) terms)',
    bodyfacts: '("THE FACTS" ONEAR(n=1000) terms OR "EN FAIT" ONEAR(n=1000) terms)',
    bodycomplaints: '("COMPLAINTS" ONEAR(n=1000) terms OR "GRIEFS" ONEAR(n=1000) terms)',
    bodylaw: '("THE LAW" ONEAR(n=1000) terms OR "EN DROIT" ONEAR(n=1000) terms)',
    bodyreasons:
      '("FOR THESE REASONS" ONEAR(n=1000) terms OR "PAR CES MOTIFS" ONEAR(n=1000) terms)',
    bodyseparateopinions:
      '(("SEPARATE OPINION" OR "SEPARATE OPINIONS") ONEAR(n=5000) terms OR "OPINION SÉPARÉE" ONEAR(n=5000) terms)',
    bodyappendix: '("APPENDIX" ONEAR(n=1000) terms OR "ANNEXE" ONEAR(n=1000) terms)',
  };

  const basicKeys = new Set([
    "docname",
    "appno",
    "scl",
    "rulesofcourt",
    "applicability",
    "ecli",
    "conclusion",
    "resolutionnumber",
    "separateopinions",
    "externalsources",
    "kpthesaurus",
    "advopidentifier",
    "documentcollectionid2",
    "languageisocode",
  ]);

  const elements: string[] = [];
  if (fullTextInput) elements.push(fullTextInput);
  let dateClause = "";

  for (const [key, valuesRaw] of Object.entries(parsed)) {
    if (key === "sort") continue;
    const values = Array.isArray(valuesRaw) ? valuesRaw : [String(valuesRaw)];
    if (key === "kpdate") {
      const lo = values[0]?.length ? `"${values[0]}"` : '"1900-01-01"';
      const hi = values[1]?.length ? `"${values[1]}"` : `"${todayIso()}"`;
      dateClause = `(kpdate>=${lo} AND kpdate<=${hi})`;
      continue;
    }
    if (basicKeys.has(key)) {
      elements.push(`(${values.join(",")})`);
      continue;
    }
    if (key === "fulltext") {
      elements.push(`(${values.join(",")})`);
      continue;
    }
    const advanced = advancedMap[key];
    if (advanced) {
      elements.push(advanced.replace("terms", values.join(",")));
      continue;
    }
    // Unknown key — pass through as a basic clause.
    elements.push(`(${values.join(",")})`);
  }
  if (dateClause) elements.push(dateClause);

  const query = elements.join(" AND ");
  const url = new URL(`${HUDOC_BASE_URL}/app/query/results`);
  url.searchParams.set("query", query);
  url.searchParams.set("select", DEFAULT_FIELDS.join(","));
  url.searchParams.set("sort", "itemid Ascending");
  url.searchParams.set("start", "0");
  url.searchParams.set("length", "500");
  return url.toString();
}

function lenientParse(s: string): Record<string, string[]> {
  // Fallback for slightly malformed JSON — split on commas at top level.
  const out: Record<string, string[]> = {};
  const stripped = s.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
  for (const pair of stripped.split(",")) {
    const idx = pair.indexOf(":");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim().replace(/^"|"$/g, "");
    const val = pair
      .slice(idx + 1)
      .trim()
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((v) => v.trim().replace(/^"|"$/g, ""));
    out[key] = val;
  }
  return out;
}
