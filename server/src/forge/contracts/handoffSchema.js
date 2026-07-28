/* server/src/forge/contracts/handoffSchema.js */

export const HANDOFF_SCHEMA_VERSION = "1.1";

export function validateHandoff(data) {
  const requiredFields = [
    "schemaVersion",
    "sessionId",
    "projectTitle",
    "projectType",
    "goal",
    "deliverables"
  ];

  const missing = requiredFields.filter(field => !data[field] && !data.header?.[field]);
  
  if (missing.length > 0) {
    throw new Error(`Invalid Handoff JSON: Missing required fields: ${missing.join(', ')}`);
  }

  return true;
}

export function canonicalizeHandoff(data) {
  // Extraction intelligente : supporte le payload direct ou enveloppé dans project_summary
  const source = data.project_summary || data;
  
  const canonical = {
    schemaVersion: source.schemaVersion || HANDOFF_SCHEMA_VERSION,
    sessionId: source.sessionId || source.header?.project_id || data.sessionId,
    projectTitle: source.projectTitle || source.title || source.header?.title,
    projectType: source.projectType || source.architecture?.stack?.[0] || 'Unknown',
    goal: source.goal || source.header?.goal || 'No goal provided',
    deliverables: source.deliverables || [],
    constraints: source.constraints || [],
    recommendedStack: source.recommendedStack || source.architecture?.stack || [],
    expertsRequired: source.expertsRequired || [],
    forgeDirectives: source.forgeDirectives || source.forge_directives || {},
    createdAt: new Date().toISOString()
  };

  return canonical;
}
