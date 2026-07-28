import { resolveSubject } from "./subjectGraph.js";

/**
 * @param {string} rawSubject
 * @param {{ activeProjectNames?: string[], inCitadelleWorkspace?: boolean }} sessionContext
 */
export function lookupInternalEntity(rawSubject = "", sessionContext = {}) {
  const graph = resolveSubject(rawSubject, {
    sessionContext,
    domain: "auto",
    preferSessionProject: true,
  });

  if (!graph.entity) return null;
  if (graph.entity.domain === "public") return null;

  return graph.entity;
}
