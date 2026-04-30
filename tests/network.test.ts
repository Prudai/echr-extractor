import { describe, it, expect } from "vitest";
import {
  extractAppNumbers,
  normalizeCaseName,
  splitCitations,
} from "../src/network/refs.js";
import { buildNodesEdges } from "../src/network/builder.js";
import type { EchrCase } from "../src/types.js";

describe("refs", () => {
  it("extracts standard application number form", () => {
    expect(extractAppNumbers("12345/67")).toEqual(["12345/67"]);
    expect(extractAppNumbers("App. nos. 12345/67 and 89/01")).toEqual([
      "12345/67",
      "89/01",
    ]);
  });

  it("normalizes case-name boilerplate", () => {
    const cleaned = normalizeCaseName(
      "EUR. COURT H.R., CASE OF SMITH v. UNITED KINGDOM, JUDGMENT OF 12 JANUARY 2010",
    );
    expect(cleaned).toContain("smith v united kingdom");
    expect(cleaned).not.toContain("eur");
    expect(cleaned).not.toContain("judgment");
  });

  it("splits citations on ; | newline", () => {
    const out = splitCitations("Foo v Bar 1234/56 ; Baz v Qux\nAnother 99/00");
    expect(out).toHaveLength(3);
  });
});

describe("buildNodesEdges", () => {
  it("links cases via shared application numbers", () => {
    const cases: EchrCase[] = [
      {
        ecli: "ECLI:CE:ECHR:2020:001",
        itemid: "001",
        appno: "12345/20",
        docname: "CASE OF A v. B",
      },
      {
        ecli: "ECLI:CE:ECHR:2021:002",
        itemid: "002",
        appno: "67890/21",
        docname: "CASE OF C v. D",
        scl: "Reference to A v. B (12345/20); unrelated 99/99",
      },
    ];
    const { nodes, edges, missingReferences } = buildNodesEdges(cases);
    expect(nodes).toHaveLength(2);
    expect(edges).toContainEqual({
      source: "ECLI:CE:ECHR:2021:002",
      target: "ECLI:CE:ECHR:2020:001",
      matchKind: "appno",
    });
    expect(missingReferences.length).toBeGreaterThan(0);
  });
});
