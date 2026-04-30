/**
 * @prudai/echr-extractor — TypeScript library for extracting case law data
 * from the European Court of Human Rights HUDOC database.
 *
 * Public API mirrors the upstream Python `echr-extractor`:
 *
 *   import { getEchr, getEchrExtra, getNodesEdges, getEchrSegments } from "@prudai/echr-extractor";
 *
 *   const cases = await getEchr({ count: 100, language: ["ENG"] });
 *   const { metadata, fullTexts } = await getEchrExtra({ count: 50 });
 *   const network = await getNodesEdges({ cases: metadata });
 *   const segments = await getEchrSegments({ cases: metadata, fullTexts });
 */

export {
  getEchr,
  getEchrExtra,
  getNodesEdges,
  getEchrSegments,
  mergeCorpus,
} from "./echr.js";
export type {
  GetEchrOptions,
  GetEchrExtraOptions,
  GetEchrExtraResult,
  GetNodesEdgesOptions,
  GetNodesEdgesResult,
  GetEchrSegmentsOptions,
} from "./echr.js";

export { fetchMetadata } from "./hudoc/client.js";
export type { FetchMetadataOptions } from "./hudoc/client.js";
export { buildQueryUrl, linkToQuery } from "./hudoc/query.js";
export {
  DEFAULT_FIELDS,
  HUDOC_BASE_URL,
  HUDOC_DOCUMENT_URL,
} from "./hudoc/fields.js";

export { downloadFullText } from "./fulltext/downloader.js";
export type { DownloadFullTextOptions } from "./fulltext/downloader.js";
export { extractFullText } from "./fulltext/parser.js";

export { buildNodesEdges } from "./network/builder.js";
export {
  APP_NO_PATTERN,
  CLEAN_PATTERNS,
  extractAppNumbers,
  splitCitations,
  normalizeCaseName,
} from "./network/refs.js";

export { segmentEchrTexts } from "./segments/segmenter.js";
export type { SegmentOptions } from "./segments/segmenter.js";

export type {
  EchrCase,
  EchrCorpusRow,
  EchrEdge,
  EchrFullText,
  EchrMissingReference,
  EchrNode,
  EchrSegment,
  LanguageCode,
  Logger,
  ParserMode,
} from "./types.js";
