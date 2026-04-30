import { getEchr, getNodesEdges } from "../src/index.js";

const cases = await getEchr({
  count: 200,
  language: ["ENG"],
  saveFile: false,
});

const { nodes, edges, missingReferences } = await getNodesEdges({
  cases,
  saveFile: false,
});

console.log(
  `Nodes: ${nodes.length}, edges: ${edges.length}, unresolved citations: ${missingReferences.length}`,
);
