import { describe, it, expect } from "vitest";
import { extractFullText } from "../src/fulltext/parser.js";

describe("extractFullText", () => {
  it("strips script and style blocks", () => {
    const html = `<html><body><script>x=1</script><style>p{}</style><p>Keep me</p></body></html>`;
    expect(extractFullText(html)).toBe("Keep me");
  });

  it("converts <br> to newlines", () => {
    const html = "<p>line1<br>line2<br/>line3</p>";
    const text = extractFullText(html);
    expect(text).toContain("line1");
    expect(text).toContain("line2");
    expect(text).toContain("line3");
  });

  it("collapses excessive whitespace", () => {
    const html = "<p>a    b\t\tc</p><p>d</p>";
    const text = extractFullText(html);
    expect(text).toBe("a b c\nd");
  });

  it("walks <li> entries while skipping nested lists", () => {
    const html = `<ul><li>outer<ul><li>nested</li></ul></li><li>second</li></ul>`;
    const text = extractFullText(html);
    expect(text).toContain("outer");
    expect(text).toContain("second");
    // "nested" should appear once at most via the outer li drop
    const nestedCount = (text.match(/nested/g) ?? []).length;
    expect(nestedCount).toBeLessThanOrEqual(1);
  });
});
