import type {
  EchrCase,
  EchrEdge,
  EchrMissingReference,
  EchrNode,
} from "../types.js";
import {
  extractAppNumbers,
  normalizeCaseName,
  splitCitations,
} from "./refs.js";

export interface NodesEdgesResult {
  nodes: EchrNode[];
  edges: EchrEdge[];
  missingReferences: EchrMissingReference[];
}

/**
 * Build a citation network from case metadata.
 *
 * - Each case with an `ecli` becomes a node.
 * - Application numbers in `appno`/`extractedappno` are matched O(1) against
 *   an index built from the same fields across the corpus.
 * - Free-text citations in `scl` are matched on normalized case name. Names
 *   that fail to resolve are recorded as missing references.
 */
export function buildNodesEdges(
  cases: ReadonlyArray<EchrCase>,
): NodesEdgesResult {
  const nodes: EchrNode[] = [];
  const byAppNo = new Map<string, string>(); // appno → ecli
  const byName = new Map<string, string>(); // normalized docname → ecli

  for (const c of cases) {
    const ecli = typeof c.ecli === "string" ? c.ecli : "";
    if (!ecli) continue;
    nodes.push({
      ecli,
      itemid: typeof c.itemid === "string" ? c.itemid : undefined,
      appno: typeof c.appno === "string" ? c.appno : undefined,
      docname: typeof c.docname === "string" ? c.docname : undefined,
      judgementdate: typeof c.judgementdate === "string" ? c.judgementdate : undefined,
      languageisocode:
        typeof c.languageisocode === "string" ? c.languageisocode : undefined,
    });

    const appNos = [
      ...extractAppNumbers(typeof c.appno === "string" ? c.appno : ""),
      ...extractAppNumbers(
        typeof c.extractedappno === "string" ? c.extractedappno : "",
      ),
    ];
    for (const a of appNos) byAppNo.set(a, ecli);

    if (typeof c.docname === "string") {
      byName.set(normalizeCaseName(c.docname), ecli);
    }
  }

  const edges: EchrEdge[] = [];
  const missing: EchrMissingReference[] = [];
  const seen = new Set<string>();

  for (const c of cases) {
    const source = typeof c.ecli === "string" ? c.ecli : "";
    if (!source) continue;
    const ownAppNos = new Set([
      ...extractAppNumbers(typeof c.appno === "string" ? c.appno : ""),
      ...extractAppNumbers(
        typeof c.extractedappno === "string" ? c.extractedappno : "",
      ),
    ]);

    const sclRaw = typeof c.scl === "string" ? c.scl : "";
    for (const citation of splitCitations(sclRaw)) {
      const cited = extractAppNumbers(citation);
      let matched = false;
      for (const a of cited) {
        if (ownAppNos.has(a)) continue;
        const target = byAppNo.get(a);
        if (target && target !== source) {
          const key = `${source}->${target}:appno`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ source, target, matchKind: "appno" });
          }
          matched = true;
        }
      }
      if (!matched) {
        const norm = normalizeCaseName(citation);
        if (norm.length >= 4) {
          const target = byName.get(norm);
          if (target && target !== source) {
            const key = `${source}->${target}:casename`;
            if (!seen.has(key)) {
              seen.add(key);
              edges.push({ source, target, matchKind: "casename" });
            }
            matched = true;
          }
        }
      }
      if (!matched && citation.length > 0) {
        missing.push({
          source,
          reference: citation,
          reason: "no appno or case-name match in corpus",
        });
      }
    }
  }

  return { nodes, edges, missingReferences: missing };
}
