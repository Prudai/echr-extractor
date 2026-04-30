import { describe, it, expect } from "vitest";
import { buildQueryUrl, linkToQuery } from "../src/hudoc/query.js";

describe("buildQueryUrl", () => {
  it("builds a default-filter URL with start/length", () => {
    const url = buildQueryUrl({ start: 0, length: 100 });
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://hudoc.echr.coe.int/app/query/results",
    );
    expect(parsed.searchParams.get("start")).toBe("0");
    expect(parsed.searchParams.get("length")).toBe("100");
    const query = parsed.searchParams.get("query") ?? "";
    expect(query).toContain("contentsitename:ECHR");
    expect(query).toContain('languageisocode="ENG"');
  });

  it("includes a date range clause when both dates are given", () => {
    const url = buildQueryUrl({
      start: 0,
      length: 50,
      startDate: "2020-01-01",
      endDate: "2020-12-31",
    });
    const query = new URL(url).searchParams.get("query") ?? "";
    expect(query).toContain('kpdate>="2020-01-01"');
    expect(query).toContain('kpdate<="2020-12-31"');
  });

  it("uses the provided field list verbatim", () => {
    const url = buildQueryUrl({
      start: 0,
      length: 1,
      fields: ["itemid", "ecli"],
    });
    expect(new URL(url).searchParams.get("select")).toBe("itemid,ecli");
  });

  it("supports multiple languages joined by OR", () => {
    const url = buildQueryUrl({ start: 0, length: 1, language: ["ENG", "FRE"] });
    const query = new URL(url).searchParams.get("query") ?? "";
    expect(query).toContain('languageisocode="ENG" OR languageisocode="FRE"');
  });
});

describe("linkToQuery", () => {
  it("converts a basic HUDOC web-UI link with documentcollectionid2", () => {
    const link =
      "https://hudoc.echr.coe.int/eng#{%22documentcollectionid2%22:[%22JUDGMENTS%22]}";
    const out = linkToQuery(link);
    const parsed = new URL(out);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      "https://hudoc.echr.coe.int/app/query/results",
    );
    expect(parsed.searchParams.get("query") ?? "").toContain("JUDGMENTS");
  });

  it("decodes a date-range link", () => {
    const link =
      'https://hudoc.echr.coe.int/eng#{"kpdate":["2020-01-01","2020-12-31"]}';
    const out = linkToQuery(link);
    const query = new URL(out).searchParams.get("query") ?? "";
    expect(query).toContain('kpdate>="2020-01-01"');
    expect(query).toContain('kpdate<="2020-12-31"');
  });
});
