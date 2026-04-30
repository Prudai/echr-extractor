# Contributing

Thanks for considering a contribution to `@prudai/echr-extractor`.

## Getting started

```bash
git clone https://github.com/prudai/echr-extractor.git
cd echr-extractor
npm install
npm test
npm run build
```

Requires Node.js 18 or newer.

## Project layout

```
src/
  echr.ts           High-level public functions (getEchr, getEchrExtra, ...)
  hudoc/            HUDOC HTTP client, query/URL builder, default field list
  fulltext/         HTML downloader and text extractor
  network/          Citation network builder and reference parsing
  segments/         Legal section segmenter (EN/FR)
  io/               CSV/JSON writers
  utils/            retry, batching, logger, csv helpers
  cli.ts            CLI entry point (commander)
tests/              Vitest unit tests
examples/           Runnable usage examples (tsx)
```

## Conventions

- **No external runtime deps** beyond `cheerio`, `commander`, and `cli-progress`. We use native `fetch` (Node 18+).
- **TypeScript strict mode** is on. Add types — never `any` without justification.
- **Tests for parsing/query logic** are required. Network calls are mocked via `vi.fn()` over `fetch`.
- **Backward compatibility:** `0.x` may break between minor versions; `1.0.0+` follows semver.

## Submitting changes

1. Open an issue to discuss non-trivial changes first.
2. Branch from `main`, name your branch `feat/...` or `fix/...`.
3. Include tests for new behavior.
4. Run `npm test` and `npm run typecheck` locally.
5. Open a PR with a clear description.

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0 (see LICENSE).
