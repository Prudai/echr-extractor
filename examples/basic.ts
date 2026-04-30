import { getEchr } from "../src/index.js";

const cases = await getEchr({
  count: 100,
  language: ["ENG"],
  verbose: true,
  saveFile: false,
});

console.log(`Fetched ${cases.length} cases.`);
console.log("First case:", cases[0]);
