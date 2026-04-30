/**
 * Core types exported from the package.
 *
 * The HUDOC API returns each case as a flat object whose keys are SharePoint
 * managed property names. We type the well-known ones and allow arbitrary
 * extras so consumers can pass `fields` lists that include uncommon names
 * without losing type safety on the standard ones.
 */

export type LanguageCode = "ENG" | "FRE" | (string & {});

/**
 * Subset of the well-known fields HUDOC returns. All are optional because
 * the caller chooses which fields to request via the `fields` option.
 */
export interface EchrCase {
  itemid?: string;
  appno?: string;
  ecli?: string;
  docname?: string;
  doctype?: string;
  doctypebranch?: string;
  article?: string;
  conclusion?: string;
  importance?: string | number;
  judgementdate?: string;
  languageisocode?: string;
  originatingbody?: string;
  violation?: string;
  nonviolation?: string;
  extractedappno?: string;
  scl?: string;
  publishedby?: string;
  representedby?: string;
  respondent?: string;
  separateopinion?: string;
  applicability?: string;
  /** Anything else the HUDOC response includes. */
  [key: string]: unknown;
}

export interface EchrFullText {
  itemId: string;
  ecli?: string;
  fullText: string;
}

export interface EchrCorpusRow extends EchrCase {
  fullText?: string;
}

export interface EchrNode {
  ecli: string;
  itemid?: string;
  appno?: string;
  docname?: string;
  judgementdate?: string;
  languageisocode?: string;
}

export interface EchrEdge {
  source: string;
  target: string;
  /** "appno" | "casename" — how the reference was matched. */
  matchKind: "appno" | "casename";
}

export interface EchrMissingReference {
  source: string;
  reference: string;
  reason: string;
}

export interface EchrSegment {
  itemid?: string;
  ecli?: string;
  languageisocode?: string;
  parserMode: ParserMode;
  procedure: string | null;
  facts: string | null;
  complaints: string | null;
  law: string | null;
  operative: string | null;
  subjectMatter: string | null;
  courtAssessment: string | null;
  separateOpinion: string | null;
  appendix: string | null;
  numSections: number;
  error: string | null;
}

export type ParserMode =
  | "standard"
  | "communicated_case"
  | "commission_decision"
  | "info_note"
  | "press_release";

/** Pluggable logger. The default writes to stderr; pass `null` to silence. */
export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}
