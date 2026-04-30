import { getEchrExtra, getEchrSegments } from "../src/index.js";

const { metadata, fullTexts } = await getEchrExtra({
  count: 10,
  language: ["ENG"],
  saveFile: false,
});

const segments = await getEchrSegments({
  cases: metadata,
  fullTexts,
  saveFile: false,
});

for (const seg of segments) {
  console.log(seg.ecli, "→", seg.numSections, "sections", `(${seg.parserMode})`);
}
