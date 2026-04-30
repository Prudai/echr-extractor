import { describe, it, expect } from "vitest";
import { segmentEchrTexts } from "../src/segments/segmenter.js";
import type { EchrCorpusRow } from "../src/types.js";

describe("segmentEchrTexts", () => {
  it("splits a standard EN judgment into procedure/facts/law/operative", () => {
    const fullText = [
      "PROCEDURE",
      "1. The case originated in an application by Smith.",
      "Some additional procedural background to ensure the segment exceeds the minimum length threshold.",
      "",
      "THE FACTS",
      "2. The applicant was born in 1970 and lives in London.",
      "Additional facts paragraph that pads this section beyond the minimum length to be retained.",
      "",
      "THE LAW",
      "3. The applicant complained of a violation of Article 6.",
      "Further legal analysis paragraph to satisfy the segmenter's minimum-length filter.",
      "",
      "FOR THESE REASONS, THE COURT, UNANIMOUSLY,",
      "1. Declares the application admissible;",
      "2. Holds that there has been a violation of Article 6.",
    ].join("\n");

    const rows: EchrCorpusRow[] = [
      {
        itemid: "001",
        ecli: "ECLI:CE:ECHR:2020:001",
        languageisocode: "ENG",
        doctype: "HEJUD",
        fullText,
      },
    ];
    const [seg] = segmentEchrTexts(rows);
    expect(seg).toBeDefined();
    expect(seg!.parserMode).toBe("standard");
    expect(seg!.procedure).toBeTruthy();
    expect(seg!.facts).toBeTruthy();
    expect(seg!.law).toBeTruthy();
    expect(seg!.operative).toBeTruthy();
    expect(seg!.numSections).toBeGreaterThanOrEqual(4);
  });

  it("filters out languages outside allowedLangs", () => {
    const rows: EchrCorpusRow[] = [
      { itemid: "1", languageisocode: "DEU", fullText: "irrelevant" },
    ];
    expect(segmentEchrTexts(rows)).toHaveLength(0);
  });

  it("skips press releases with a parser_mode error", () => {
    const rows: EchrCorpusRow[] = [
      {
        itemid: "1",
        languageisocode: "ENG",
        doctype: "PRESSRELEASE",
        fullText: "anything",
      },
    ];
    const [seg] = segmentEchrTexts(rows);
    expect(seg!.parserMode).toBe("press_release");
    expect(seg!.error).toContain("press_release");
  });
});
