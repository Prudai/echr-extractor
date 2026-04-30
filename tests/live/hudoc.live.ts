/**
 * Live HUDOC integration test.
 *
 * Hits the real https://hudoc.echr.coe.int API. Run with:
 *   npx tsx tests/live/hudoc.live.ts
 *
 * Exits non-zero on any failed assertion. Prints a summary.
 */
import {
  getEchr,
  getEchrExtra,
  getNodesEdges,
  getEchrSegments,
  buildQueryUrl,
  extractFullText,
  fetchMetadata,
} from "../../src/index.js";

let failed = 0;
function check(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  console.log("=== Live HUDOC integration test ===\n");

  // 1. URL builder + raw fetch
  console.log("[1] buildQueryUrl + fetchMetadata");
  const probeUrl = buildQueryUrl({
    start: 0,
    length: 5,
    fields: ["itemid", "ecli", "docname", "languageisocode", "judgementdate"],
    language: ["ENG"],
  });
  console.log("    URL:", probeUrl.slice(0, 110) + "...");
  const probe = await fetchMetadata({
    batchSize: 5,
    endId: 5,
    fields: ["itemid", "ecli", "docname", "languageisocode", "judgementdate"],
    language: ["ENG"],
  });
  check("fetched at least 1 row", probe.length >= 1, `got ${probe.length}`);
  check("rows include itemid", probe.every((r) => typeof r.itemid === "string"));
  check("rows include ecli", probe.every((r) => typeof r.ecli === "string"));
  check(
    "rows include languageisocode = ENG",
    probe.every((r) => r.languageisocode === "ENG"),
  );

  // 2. getEchr (high-level, no save)
  console.log("\n[2] getEchr count=10, language=ENG, no save");
  const cases = await getEchr({
    count: 10,
    language: ["ENG"],
    saveFile: false,
  });
  check("returned 10 cases", cases.length === 10, `got ${cases.length}`);
  check(
    "all cases have an itemid",
    cases.every((c) => !!c.itemid),
  );
  console.log(
    "    Sample:",
    JSON.stringify({
      itemid: cases[0]?.itemid,
      ecli: cases[0]?.ecli,
      docname: cases[0]?.docname,
    }),
  );

  // 3. Date range
  console.log("\n[3] getEchr with date range 2023-01-01..2023-01-31");
  const dated = await getEchr({
    startDate: "2023-01-01",
    endDate: "2023-01-31",
    endId: 20,
    language: ["ENG"],
    saveFile: false,
  });
  check(
    "returned rows in date range",
    dated.length > 0,
    `got ${dated.length}`,
  );
  if (dated.length > 0) {
    // HUDOC returns dates as DD/MM/YYYY HH:MM:SS — convert before comparing.
    const withDate = dated.filter(
      (c) => typeof c.judgementdate === "string" && c.judgementdate.length >= 10,
    );
    const toIso = (s: string): string => {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : s.slice(0, 10);
    };
    const outOfRange = withDate.filter((c) => {
      const d = toIso(c.judgementdate as string);
      return d < "2023-01-01" || d > "2023-01-31";
    });
    if (outOfRange.length > 0) {
      console.log(
        "    Out-of-range samples:",
        outOfRange
          .slice(0, 3)
          .map((c) => ({ itemid: c.itemid, judgementdate: c.judgementdate })),
      );
    }
    check(
      "all dated rows fall inside the requested window",
      outOfRange.length === 0,
      `${withDate.length}/${dated.length} rows had a date; ${outOfRange.length} out of range`,
    );
  }

  // 4. Full text — use a modern date range so we exercise the standard
  // judgment format (the very oldest HUDOC docs are 1959 Commission
  // decisions with non-standard headers).
  console.log("\n[4] getEchrExtra date 2023-06-01..2023-06-30 → full text");
  const extra = await getEchrExtra({
    startDate: "2023-06-01",
    endDate: "2023-06-30",
    endId: 5,
    language: ["ENG"],
    threads: 3,
    saveFile: false,
  });
  check("metadata count > 0", extra.metadata.length > 0, `got ${extra.metadata.length}`);
  check("at least 1 full text downloaded", extra.fullTexts.length >= 1);
  if (extra.fullTexts.length > 0) {
    const ft = extra.fullTexts[0]!;
    check("full text is a non-empty string", ft.fullText.length > 100);
    const anyHasHeader = extra.fullTexts.some((f) =>
      /PROCEDURE|THE FACTS|THE LAW|FOR THESE REASONS/.test(f.fullText),
    );
    check(
      "at least one full text contains a standard ECHR header",
      anyHasHeader,
    );
    console.log(`    First doc: ${ft.itemId} (${ft.fullText.length} chars)`);
  }

  // 5. HTML parser direct test
  console.log("\n[5] extractFullText on a real HUDOC document");
  if (extra.metadata[0]?.itemid) {
    const id = extra.metadata[0].itemid;
    const url = `https://hudoc.echr.coe.int/app/conversion/docx/html/body?library=ECHR&id=${encodeURIComponent(
      id,
    )}`;
    const res = await fetch(url);
    const html = await res.text();
    const text = extractFullText(html);
    check("extracted text > 500 chars", text.length > 500, `got ${text.length}`);
    check("text has no script tags", !text.includes("<script"));
  }

  // 6. Network builder — modern cases so most have an ecli
  console.log("\n[6] getNodesEdges on a modern corpus");
  const corpus = await getEchr({
    startDate: "2022-01-01",
    endDate: "2022-12-31",
    endId: 50,
    language: ["ENG"],
    saveFile: false,
  });
  const network = await getNodesEdges({ cases: corpus, saveFile: false });
  const corpusWithEcli = corpus.filter(
    (c) => typeof c.ecli === "string" && c.ecli.length > 0,
  ).length;
  check(
    "nodes match cases with non-empty ecli",
    network.nodes.length === corpusWithEcli,
    `nodes=${network.nodes.length} expected=${corpusWithEcli}`,
  );
  check("edges is an array", Array.isArray(network.edges));
  check("missingReferences is an array", Array.isArray(network.missingReferences));
  console.log(
    `    nodes=${network.nodes.length} edges=${network.edges.length} missing=${network.missingReferences.length}`,
  );

  // 7. Segmenter on real text
  console.log("\n[7] getEchrSegments on extra full texts");
  const segments = await getEchrSegments({
    cases: extra.metadata,
    fullTexts: extra.fullTexts,
    saveFile: false,
  });
  check("segments returned for at least 1 doc", segments.length >= 1);
  if (segments.length > 0) {
    const totalSections = segments.reduce((sum, s) => sum + s.numSections, 0);
    check("at least one section detected across docs", totalSections > 0);
    console.log(
      "    Sample:",
      JSON.stringify(
        {
          ecli: segments[0]!.ecli,
          parserMode: segments[0]!.parserMode,
          numSections: segments[0]!.numSections,
          hasProcedure: segments[0]!.procedure !== null,
          hasFacts: segments[0]!.facts !== null,
          hasLaw: segments[0]!.law !== null,
          hasOperative: segments[0]!.operative !== null,
        },
        null,
        0,
      ),
    );
  }

  console.log("\n=== Summary ===");
  console.log(failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
