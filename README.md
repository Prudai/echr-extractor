# @prudai/echr-extractor

[![npm version](https://img.shields.io/npm/v/@prudai/echr-extractor.svg)](https://www.npmjs.com/package/@prudai/echr-extractor)
[![CI](https://github.com/prudai/echr-extractor/actions/workflows/ci.yml/badge.svg)](https://github.com/prudai/echr-extractor/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

TypeScript library and CLI for extracting case-law data from the **European Court of Human Rights** [HUDOC database](https://hudoc.echr.coe.int/) — metadata, full text, citation networks, and structured legal sections.

## Features

- **Metadata harvest** with date-window batching, exponential-backoff retries, and pagination.
- **Full-text download** with concurrent workers and HTML-to-plain-text extraction.
- **Citation network** — nodes and edges from `appno`/`scl` references, with a missing-references report.
- **Section segmentation** — splits judgments into procedure / facts / complaints / law / operative / separate opinion / appendix (EN + FR).
- **Native fetch** (Node 20+). No Python, no `pandas`, no heavyweight HTTP clients.
- **TypeScript-first** with full type definitions, ESM and CJS builds.
- **CLI** that mirrors the upstream tool: `echr-extractor extract | extract-full | network | segment`.

## Install

```bash
npm install @prudai/echr-extractor
```

Requires **Node.js 20 or newer**.

## Quick start

```ts
import { getEchr, getEchrExtra, getNodesEdges, getEchrSegments } from "@prudai/echr-extractor";

// Metadata only
const cases = await getEchr({ count: 100, language: ["ENG"] });

// Metadata + full text
const { metadata, fullTexts } = await getEchrExtra({
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  language: ["ENG"],
  threads: 10,
});

// Citation network
const { nodes, edges, missingReferences } = await getNodesEdges({ cases: metadata });

// Structured legal sections
const segments = await getEchrSegments({
  cases: metadata,
  fullTexts,
  allowedLangs: ["ENG", "FRE"],
});
```

## CLI

```bash
# Fetch 100 English cases and save to data/echr_metadata_*.csv
npx echr-extractor extract --count 100 --language ENG --verbose

# Metadata + full text with 10 concurrent downloads
npx echr-extractor extract-full --count 50 --language ENG --threads 10

# Build a citation network from a saved metadata file
npx echr-extractor network --metadata-path data/echr_metadata_0-100_dates_START-END.csv

# Segment full texts
npx echr-extractor segment \
  --metadata-path data/echr_metadata_0-50_dates_START-END.csv \
  --fulltext-path data/echr_full_text_0-50_dates_START-END.json \
  --allowed-langs ENG FRE
```

## API reference

### `getEchr(options)`

Fetch case metadata from HUDOC.

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `startId` | `number` | `0` | Index to start from. |
| `endId` | `number \| null` | `null` | Index to stop at; `null` fetches all. |
| `count` | `number` | — | Alternative to `endId`. |
| `startDate` | `string` (`YYYY-MM-DD`) | — | Inclusive lower bound on `kpdate`. |
| `endDate` | `string` (`YYYY-MM-DD`) | — | Inclusive upper bound on `kpdate`. |
| `language` | `string[]` | `["ENG"]` | Language filter. |
| `fields` | `string[]` | `DEFAULT_FIELDS` | Managed properties to request. |
| `link` | `string` | — | Use a custom HUDOC query URL (overrides builders). |
| `queryPayload` | `string` | — | Replace the default doctype filter. |
| `batchSize` | `number` | `500` | Records per request (max 500). |
| `timeoutMs` | `number` | `60_000` | Per-request timeout. |
| `retryAttempts` | `number` | `3` | Retries per request. |
| `maxAttempts` | `number` | `20` | Hard ceiling across batches. |
| `daysPerBatch` | `number` | `365` | Date-window size when both dates are given. |
| `saveFile` | `boolean` | `true` | Write CSV to `outDir`. |
| `outDir` | `string` | `"data"` | Output directory. |
| `verbose` | `boolean` | `false` | Print progress to stderr. |
| `logger` | `Logger \| null` | — | Custom logger or `null` to silence. |
| `fetchImpl` | `typeof fetch` | `globalThis.fetch` | Inject a custom fetch. |

Returns `Promise<EchrCase[]>`.

### `getEchrExtra(options)`

`getEchr` + concurrent full-text download. Adds `threads` (default `10`).
Returns `Promise<{ metadata: EchrCase[]; fullTexts: EchrFullText[] }>`.

### `getNodesEdges({ cases?, metadataPath?, saveFile?, outDir? })`

Build a citation network from metadata. Either pass `cases` directly or load from a saved CSV/JSON via `metadataPath`.
Returns `Promise<{ nodes, edges, missingReferences }>`.

### `getEchrSegments({ cases?, fullTexts?, corpus?, allowedLangs?, minSegmentLength?, saveFile?, outDir? })`

Segment full-text judgments into structured legal sections.
Returns `Promise<EchrSegment[]>` where each segment has nullable string fields per section plus `parserMode`, `numSections`, and `error`.

### Lower-level building blocks

```ts
import {
  fetchMetadata,           // raw metadata fetch (no save)
  buildQueryUrl,           // assemble a HUDOC query URL
  linkToQuery,             // convert a HUDOC web-UI URL to a query API URL
  downloadFullText,        // concurrent full-text download
  extractFullText,         // HTML → plain text
  buildNodesEdges,         // pure citation network builder
  segmentEchrTexts,        // pure segmenter
  DEFAULT_FIELDS,
  HUDOC_BASE_URL,
  HUDOC_DOCUMENT_URL,
} from "@prudai/echr-extractor";
```

## Output file layout

When `saveFile` is true the package writes files matching the upstream Python conventions, so output is interchangeable:

```text
data/
  echr_metadata_<idRange>_<dateRange>.csv
  echr_full_text_<idRange>_<dateRange>.json
  ECHR_nodes.csv / ECHR_nodes.json
  ECHR_edges.csv / ECHR_edges.json
  ECHR_missing_references.csv
  echr_segments.csv
```

## Custom HUDOC links

If you have a HUDOC web-UI URL, pass it through `linkToQuery` to convert it into the query API URL the package uses:

```ts
import { linkToQuery, fetchMetadata } from "@prudai/echr-extractor";

const url = linkToQuery("https://hudoc.echr.coe.int/eng#{...}");
const cases = await fetchMetadata({ link: url, batchSize: 500 });
```

## Development

```bash
git clone https://github.com/prudai/echr-extractor.git
cd echr-extractor
npm install
npm test
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License & attribution

Apache License 2.0. See [LICENSE](LICENSE).

This project is a derivative work of [`echr-extractor`](https://github.com/maastrichtlawtech/echr-extractor) (Apache 2.0) by the Maastricht Law & Tech Lab. Required attribution is preserved in [NOTICE](NOTICE).
