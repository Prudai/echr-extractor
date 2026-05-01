# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-01

### Changed

- **Breaking:** minimum supported Node.js version is now **20**. Node 18 reached end-of-life on 30 April 2025, and our HTML parser dependency (`cheerio` -> `undici`) references `globalThis.File`, which is only available as a global since Node 20.
- CI matrix updated to test against Node 20 and 22 across Linux, macOS, and Windows.
- `tsup` build target bumped from `node18` to `node20`.

## [0.1.0] - 2026-04-30

### Added

- Initial TypeScript port of [`echr-extractor`](https://github.com/maastrichtlawtech/echr-extractor).
- `getEchr()` — fetch ECHR case metadata from HUDOC with date batching, retry, and progress reporting.
- `getEchrExtra()` — fetch metadata plus full text via concurrent downloads.
- `getNodesEdges()` — build a citation network (nodes, edges, missing references) from metadata.
- `getEchrSegments()` — segment full-text judgments into structured legal sections (procedure, facts, complaints, law, operative, separate opinions, appendix, subject matter, court assessment).
- `linkToQuery()` — convert a HUDOC web-UI URL into a query API URL.
- CLI: `echr-extractor extract | extract-full | network | segment`.
- Saves results as CSV/JSON when `saveFile` is enabled.
