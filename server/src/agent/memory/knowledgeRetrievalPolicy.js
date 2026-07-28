export function selectRelevantKnowledgeRecords({
  records,
  currentSessionId = null,
  activeProjectId = null,
  scopesAllowed = ["session", "project", "workspace", "global"],
  maxItems = 5,
}) {
  if (!Array.isArray(records)) {
    return { selected: [], truncated: false, total_considered: 0 };
  }

  const scopePriority = {
    session: 0,
    project: 1,
    workspace: 2,
    global: 3,
  };

  const filtered = records
    .filter((record) => record.status === "active")
    .filter((record) => scopesAllowed.includes(record.scope))
    .filter((record) => {
      if (record.scope === "project" && activeProjectId) {
        return record.project_id ? record.project_id === activeProjectId : true;
      }
      if (record.scope === "session" && currentSessionId) {
        return record.sources?.some(
          (source) => source.session_id === currentSessionId,
        );
      }
      return true;
    });

  const sorted = filtered.sort((a, b) => {
    const byScope = scopePriority[a.scope] - scopePriority[b.scope];
    if (byScope !== 0) return byScope;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const selected = [];
  const seenSubjects = new Set();

  for (const record of sorted) {
    if (selected.length >= maxItems) break;
    if (seenSubjects.has(record.subject)) continue;
    selected.push(record);
    seenSubjects.add(record.subject);
  }

  return {
    selected,
    truncated: sorted.length > selected.length,
    total_considered: filtered.length,
  };
}

export function scoreKnowledgeRecord(record, context = {}) {
  let score = 0;
  if (record.scope === "session") score += 30;
  if (record.scope === "project") score += 20;
  if (record.scope === "workspace") score += 10;
  if (record.scope === "global") score += 5;
  score += Math.floor((record.confidence ?? 0) * 20);

  if (
    context.activeProjectId &&
    record.project_id === context.activeProjectId
  ) {
    score += 5;
  }
  if (
    context.currentSessionId &&
    record.sources?.some((s) => s.session_id === context.currentSessionId)
  ) {
    score += 5;
  }

  return score;
}

export function groupKnowledgeRecordsForPrompt(records) {
  const groups = {
    technical_facts: [],
    environment_facts: [],
    project_facts: [],
    workflow_rules: [],
    user_preferences: [],
  };

  for (const record of records) {
    switch (record.kind) {
      case "technical_fact":
        groups.technical_facts.push(record);
        break;
      case "environment_fact":
        groups.environment_facts.push(record);
        break;
      case "project_fact":
        groups.project_facts.push(record);
        break;
      case "workflow_rule":
        groups.workflow_rules.push(record);
        break;
      case "user_preference":
        groups.user_preferences.push(record);
        break;
      default:
        break;
    }
  }

  return groups;
}

export function formatKnowledgeHubXml(recordsByGroup) {
  const escape = (text) =>
    String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const variants = Object.entries(recordsByGroup).filter(
    ([, items]) => items.length > 0,
  );

  if (variants.length === 0) return "";

  let xml = "<knowledge_hub>\n";

  for (const [groupName, records] of variants) {
    xml += `  <${groupName}>\n`;
    for (const record of records) {
      xml += `    <fact id="${record.knowledge_id}" kind="${record.kind}" scope="${record.scope}">`;
      xml += escape(record.statement_canonical);
      xml += `</fact>\n`;
    }
    xml += `  </${groupName}>\n`;
  }

  xml += "</knowledge_hub>";
  return xml;
}
