import * as cheerio from "cheerio";

/**
 * Extract plain text from a HUDOC HTML body. Mirrors the upstream Python
 * `get_full_text_from_html`: drops scripts/styles, converts `<br>` to
 * newlines, walks `<p>` and `<li>` elements (excluding nested lists), then
 * normalizes whitespace.
 */
export function extractFullText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style").remove();
  $("br").replaceWith("\n");

  const lines: string[] = [];
  $("p, li").each((_, el) => {
    const $el = $(el);
    if (el.tagName === "li") {
      // Drop nested lists so their text isn't double-counted by the outer <li>.
      $el.find("ul, ol").remove();
    }
    const text = $el.text();
    if (text) lines.push(text);
  });

  return normalize(lines.join("\n"));
}

function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
