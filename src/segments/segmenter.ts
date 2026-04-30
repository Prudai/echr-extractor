import type { EchrCorpusRow, EchrSegment, ParserMode } from "../types.js";

export interface SegmentOptions {
  allowedLangs?: ReadonlyArray<string>;
  /** Discard sections shorter than this (chars). Default 50. */
  minSegmentLength?: number;
}

/**
 * Segment ECHR judgment full text into structured legal sections.
 *
 * This is a port of the upstream Python segmenter. It uses bilingual
 * (EN/FR) header regexes and a two-pass scan to assign each character
 * range to one of nine canonical sections (procedure, facts, complaints,
 * law, operative, subject_matter, court_assessment, separate_opinion,
 * appendix). Document doctype routes to one of four parser modes; press
 * releases and info notes are skipped.
 */
export function segmentEchrTexts(
  rows: ReadonlyArray<EchrCorpusRow>,
  opts: SegmentOptions = {},
): EchrSegment[] {
  const allowedLangs = new Set(opts.allowedLangs ?? ["ENG", "FRE"]);
  const minLen = opts.minSegmentLength ?? 50;

  const out: EchrSegment[] = [];
  for (const row of rows) {
    const lang = typeof row.languageisocode === "string" ? row.languageisocode : "";
    if (allowedLangs.size && !allowedLangs.has(lang)) continue;
    out.push(segmentOne(row, minLen));
  }
  return out;
}

function segmentOne(row: EchrCorpusRow, minLen: number): EchrSegment {
  const base: EchrSegment = {
    itemid: typeof row.itemid === "string" ? row.itemid : undefined,
    ecli: typeof row.ecli === "string" ? row.ecli : undefined,
    languageisocode:
      typeof row.languageisocode === "string" ? row.languageisocode : undefined,
    parserMode: routeParserMode(row),
    procedure: null,
    facts: null,
    complaints: null,
    law: null,
    operative: null,
    subjectMatter: null,
    courtAssessment: null,
    separateOpinion: null,
    appendix: null,
    numSections: 0,
    error: null,
  };

  if (base.parserMode === "info_note" || base.parserMode === "press_release") {
    base.error = `skipped: parser_mode=${base.parserMode}`;
    return base;
  }

  const text = typeof row.fullText === "string" ? row.fullText : "";
  if (!text || text.length < minLen) {
    base.error = "missing or too-short fulltext";
    return base;
  }

  const boundaries = findBoundaries(text);
  const slices = sliceByBoundaries(text, boundaries);

  for (const [section, content] of slices) {
    if (content.length < minLen) continue;
    assignSection(base, section, content);
  }
  base.numSections = countSections(base);
  return base;
}

function routeParserMode(row: EchrCorpusRow): ParserMode {
  const dt = (typeof row.doctype === "string" ? row.doctype : "").toUpperCase();
  const branch = (typeof row.doctypebranch === "string" ? row.doctypebranch : "")
    .toUpperCase();
  if (dt === "PRESSRELEASE" || dt === "PRES") return "press_release";
  if (dt === "INFONOTE" || dt === "CLIN") return "info_note";
  if (branch === "COMMUNICATEDCASES" || dt === "COMMUNICATEDCASES")
    return "communicated_case";
  if (dt === "DECCOMM" || branch === "COMMISSION") return "commission_decision";
  return "standard";
}

type SectionKey =
  | "procedure"
  | "facts"
  | "complaints"
  | "law"
  | "operative"
  | "subject_matter"
  | "court_assessment"
  | "separate_opinion"
  | "appendix";

interface SectionPattern {
  key: SectionKey;
  patterns: RegExp[];
}

const SECTION_PATTERNS: SectionPattern[] = [
  {
    key: "procedure",
    patterns: [
      /(^|\n)\s*PROCEDURE\b/g,
      /(^|\n)\s*PROC[ÉE]DURE\b/g,
      /(^|\n)\s*THE\s+PROCEDURE\b/g,
      /(^|\n)\s*LA\s+PROC[ÉE]DURE\b/g,
    ],
  },
  {
    key: "facts",
    patterns: [
      /(^|\n)\s*THE\s+FACTS\b/g,
      /(^|\n)\s*EN\s+FAIT\b/g,
      /(^|\n)\s*I\.?\s+THE\s+CIRCUMSTANCES\s+OF\s+THE\s+CASE/gi,
    ],
  },
  {
    key: "complaints",
    patterns: [
      /(^|\n)\s*COMPLAINTS?\b/g,
      /(^|\n)\s*GRIEFS\b/g,
    ],
  },
  {
    key: "law",
    patterns: [
      /(^|\n)\s*THE\s+LAW\b/g,
      /(^|\n)\s*EN\s+DROIT\b/g,
    ],
  },
  {
    key: "operative",
    patterns: [
      /(^|\n)\s*FOR\s+THESE\s+REASONS,?\s+THE\s+COURT/gi,
      /(^|\n)\s*PAR\s+CES\s+MOTIFS,?\s+LA\s+COUR/gi,
    ],
  },
  {
    key: "subject_matter",
    patterns: [
      /(^|\n)\s*SUBJECT\s+MATTER\s+OF\s+THE\s+CASE/gi,
      /(^|\n)\s*OBJET\s+DE\s+L[’']?\s*AFFAIRE/gi,
    ],
  },
  {
    key: "court_assessment",
    patterns: [
      /(^|\n)\s*THE\s+COURT'?S\s+ASSESSMENT/gi,
      /(^|\n)\s*APPR[ÉE]CIATION\s+DE\s+LA\s+COUR/gi,
    ],
  },
  {
    key: "separate_opinion",
    patterns: [
      /(^|\n)\s*SEPARATE\s+OPINIONS?\b/g,
      /(^|\n)\s*OPINION\s+S[ÉE]PAR[ÉE]E\b/g,
      /(^|\n)\s*CONCURRING\s+OPINION\b/gi,
      /(^|\n)\s*DISSENTING\s+OPINION\b/gi,
    ],
  },
  {
    key: "appendix",
    patterns: [
      /(^|\n)\s*APPENDIX\b/g,
      /(^|\n)\s*ANNEXE\b/g,
    ],
  },
];

interface Boundary {
  index: number;
  section: SectionKey;
}

function findBoundaries(text: string): Boundary[] {
  const found: Boundary[] = [];
  for (const { key, patterns } of SECTION_PATTERNS) {
    for (const raw of patterns) {
      const re = new RegExp(raw.source, raw.flags.includes("g") ? raw.flags : `${raw.flags}g`);
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        found.push({ index: m.index + (m[1]?.length ?? 0), section: key });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
  }
  found.sort((a, b) => a.index - b.index);

  // Drop near-duplicate boundaries within 100 chars unless they belong to
  // different sections.
  const filtered: Boundary[] = [];
  for (const b of found) {
    const prev = filtered[filtered.length - 1];
    if (prev && b.index - prev.index < 100 && prev.section === b.section) continue;
    filtered.push(b);
  }
  return filtered;
}

function sliceByBoundaries(
  text: string,
  boundaries: Boundary[],
): Array<[SectionKey, string]> {
  if (boundaries.length === 0) return [];
  const slices: Array<[SectionKey, string]> = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]!.index;
    const end = boundaries[i + 1]?.index ?? text.length;
    slices.push([boundaries[i]!.section, text.slice(start, end).trim()]);
  }
  return slices;
}

function assignSection(
  seg: EchrSegment,
  key: SectionKey,
  content: string,
): void {
  const target = key === "subject_matter"
    ? "subjectMatter"
    : key === "court_assessment"
      ? "courtAssessment"
      : key === "separate_opinion"
        ? "separateOpinion"
        : key;
  const existing = seg[target as keyof EchrSegment] as string | null;
  const merged = existing ? `${existing}\n\n${content}` : content;
  (seg as unknown as Record<string, unknown>)[target] = merged;
}

function countSections(seg: EchrSegment): number {
  return (
    [
      seg.procedure,
      seg.facts,
      seg.complaints,
      seg.law,
      seg.operative,
      seg.subjectMatter,
      seg.courtAssessment,
      seg.separateOpinion,
      seg.appendix,
    ].filter((v) => v !== null && v !== undefined).length
  );
}
