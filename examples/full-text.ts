import { getEchrExtra } from "../src/index.js";

const { metadata, fullTexts } = await getEchrExtra({
  count: 25,
  language: ["ENG"],
  threads: 5,
  verbose: true,
  saveFile: false,
});

console.log(`Cases: ${metadata.length}, full texts: ${fullTexts.length}`);
console.log("Excerpt:", fullTexts[0]?.fullText.slice(0, 500));
