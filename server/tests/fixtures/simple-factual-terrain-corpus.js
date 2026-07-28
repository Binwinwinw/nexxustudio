/** Corpus terrain — couloir simple_factual_lookup + factualSanityGate. */

/** @typedef {'valid'|'trap'|'ambiguous'} TerrainBucket */
/** @typedef {'answer'|'abstain'|'clarify'} TerrainTarget */

/**
 * @type {Array<{ id: string, bucket: TerrainBucket, q: string, target: TerrainTarget }>}
 */
export const SIMPLE_FACTUAL_TERRAIN_CORPUS = [
  { id: "V1", bucket: "valid", q: "Dans quelle ville se trouve le Parc Astérix ?", target: "answer" },
  { id: "V2", bucket: "valid", q: "Où se trouve la Tour Eiffel ?", target: "answer" },
  { id: "V3", bucket: "valid", q: "Quelle est la capitale de l'Italie ?", target: "answer" },
  { id: "V4", bucket: "valid", q: "En quelle année a débuté la Première Guerre mondiale ?", target: "answer" },
  { id: "P1", bucket: "trap", q: "Où se trouve la tour de pizz ?", target: "abstain" },
  { id: "P2", bucket: "trap", q: "Dans quelle ville se trouve le château de Poudlard en France ?", target: "abstain" },
  { id: "P3", bucket: "trap", q: "Quelle est la capitale du royaume de Westeros ?", target: "abstain" },
  { id: "A1", bucket: "ambiguous", q: "Dans quelle ville vaut-il mieux ouvrir mon restaurant ?", target: "clarify" },
  { id: "A2", bucket: "ambiguous", q: "Où se trouve-ce ?", target: "clarify" },
  { id: "A3", bucket: "ambiguous", q: "Quel plan proposes-tu pour visiter le Parc Astérix ?", target: "clarify" },
];
