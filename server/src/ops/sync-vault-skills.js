/**
 * Sync hub SKILLS.md ↔ Vault modules/skills.md (Phase D).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSkillsDashboard } from './dashboard-skills.js';
import { loadSkills, REPO_ROOT } from '../agent/utils/skillRuntimeRegistry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SKILLS_HUB_PATH = path.join(REPO_ROOT, 'server', 'data', 'skills', 'SKILLS.md');
export const VAULT_MODULES_SKILLS_PATH = path.join(
  REPO_ROOT,
  'citadelle-vault',
  'Citadelle',
  '02-Architecture',
  'modules',
  'skills.md',
);

const WAVE2_IDS = [
  'skill-pdf-extraction',
  'skill-egress-security',
  'skill-memory-governance',
  'skill-quality-gate',
];

const PENDING_BACKLOG = [];

const MEDIUM_PRIORITY_IDS = [
  'skill-hybrid-retrieval',
  'skill-mcp-bridge',
];

function formatDateFr(iso) {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function primaryRuntimeModule(entry) {
  const modules = entry.meta.runtimeModules || [];
  const primary = modules.find((mod) => mod.required !== false) || modules[0];
  if (!primary) return '—';
  return `\`${path.basename(primary.path)}\``;
}

function wikiLink(skillId) {
  return `[[${skillId}]]`;
}

/**
 * @param {object} dashboard
 * @param {Array<{ name: string, meta: object }>} skills
 */
export function renderSkillsHubMarkdown(dashboard, skills) {
  const generatedAt = dashboard.generatedAt;
  const dateLabel = formatDateFr(generatedAt);

  const wave2Rows = WAVE2_IDS.map((id) => {
    const entry = skills.find((skill) => skill.name === id);
    if (!entry) return `| ${id} | — | — | ❌ |`;
    const runtime = primaryRuntimeModule(entry);
    const status = entry.meta.runtimeModules?.length ? '✅' : '❌';
    return `| ${wikiLink(id)} | ${entry.meta.name} | ${runtime} | ${status} |`;
  }).join('\n');

  const runtimeBackedList = skills
    .filter((entry) => entry.meta.runtimeModules?.length > 0)
    .map((entry) => `- ${wikiLink(entry.name)} — ${entry.meta.description}`)
    .join('\n');

  const promptOnlyList = skills
    .filter((entry) => !entry.meta.runtimeModules?.length)
    .map((entry) => {
      const flag =
        entry.meta.requiresRuntime === false ? '`false`' : '`undefined`';
      const parent = entry.meta.parentSkillId
        ? ` (parent: ${entry.meta.parentSkillId})`
        : '';
      return `| ${entry.name} | ${flag} | ${entry.meta.description}${parent} |`;
    })
    .join('\n');

  const kpiRows = WAVE2_IDS.map((id) => {
    const entry = skills.find((skill) => skill.name === id);
    if (!entry?.meta.kpis) return `| ${id} | — | — |`;
    const target = entry.meta.kpis.triggerAccuracyTarget ?? '—';
    const fallback = entry.meta.kpis.fallbackRateMax ?? '—';
    return `| ${id} | ${target} | ${fallback} |`;
  }).join('\n');

  const subSkillsBlock = skills
    .filter((entry) => entry.meta.parentSkillId === 'skill-obsidian-governance')
    .map((entry) => `- ${wikiLink(entry.name)} — ${entry.meta.description}`)
    .join('\n');

  return `# Hub des Skills — La Citadelle

> **Version** : v1.6 | **Dernière mise à jour** : ${dateLabel} | **Total skills** : ${dashboard.summary.totalSkills}
>
> **Plateforme uniquement** — skills runtime \`server/data/skills/\`. Les skills workspace IDE (Cursor, Copilot) ne sont **pas** chargés ici. Voir \`AGENTS.md\` §2.3.

## Dashboard en direct

\`\`\`bash
cd server && npm run dashboard:skills
cd server && npm run ops:full
\`\`\`

**État actuel** (${generatedAt}) :
- 🟢 Runtime-backed: **${dashboard.summary.runtimeBacked}** skills
- 🔵 Prompt-only: **${dashboard.summary.promptOnly}** skills
- 🧩 Sub-skills: **${dashboard.summary.subSkills}** skills
- ❌ Errors: **${dashboard.summary.errors}** | ⚠️ Warnings: **${dashboard.summary.warnings}**

## Couverture Vague 2

| Skill | Nom | Runtime principal | Statut |
|-------|-----|-------------------|--------|
${wave2Rows}

## Arborescence des skills

\`\`\`
server/data/skills/
├── SKILLS.md                    ← ce hub (central)
├── skill-pdf-extraction/
├── skill-egress-security/
├── skill-memory-governance/
├── skill-quality-gate/
├── skill-obsidian-governance/
│   └── (sub-skills ADR-008)
│       ├── skill-obsidian-markdown/
│       ├── skill-obsidian-canvas/
│       └── skill-obsidian-cli/
└── … (${dashboard.summary.totalSkills - 4} autres dossiers skill-*)
\`\`\`

## Navigation par catégorie

### Priorité haute (Vague 2)
${WAVE2_IDS.map((id) => {
  const entry = skills.find((skill) => skill.name === id);
  return entry
    ? `- ${wikiLink(id)} — ${entry.meta.description}`
    : `- ${id} — *(absent)*`;
}).join('\n')}

### Obsidian — parent + sub-skills (ADR-008)
- ${wikiLink('skill-obsidian-governance')} — parent Vault / wiki / ingestion ADR
${subSkillsBlock}

### Runtime-backed (autres)
${runtimeBackedList || '- *(aucun)*'}

### Backlog (pending — non déployés)
${PENDING_BACKLOG.length > 0 ? PENDING_BACKLOG.map((id) => `- ${id} — *(pending)*`).join('\n') : '- *(aucun — migration clôturée)*'}

### Priorité moyenne (Phase E)
${MEDIUM_PRIORITY_IDS.map((id) => {
  const entry = skills.find((skill) => skill.name === id);
  return entry
    ? `- ${wikiLink(id)} — ${entry.meta.description}`
    : `- ${id} — *(absent)*`;
}).join('\n')}

## Skills procéduraux (prompt-only)

Ces skills n'ont **pas de module runtime JavaScript** déclaré — procédures injectées dans le prompt :

| Skill | requiresRuntime | Description |
|-------|-----------------|-------------|
${promptOnlyList}

## Métriques KPI (Vague 2)

| Skill | triggerAccuracyTarget | fallbackRateMax |
|-------|----------------------|-----------------|
${kpiRows}

## Désactivation (feature flag)

\`\`\`bash
SKILLS_DISABLED=skill-pdf-extraction,skill-quality-gate
\`\`\`

Fallback : \`fallbackSkillId\` dans \`meta.json\` (ex. PDF → \`skill-document-analysis\`).

## Synchronisation Vault

Ce hub est synchronisé avec :
- [modules/skills.md](../../../citadelle-vault/Citadelle/02-Architecture/modules/skills.md)
- [reports/skills-dashboard.json](../../../citadelle-vault/Citadelle/04-Operations/reports/skills-dashboard.json)

\`\`\`bash
cd server && npm run vault:sync
\`\`\`

## Documentation associée

- [[Synthèse-Migration-Skills-Runtime]] — onboarding équipe (migration clôturée)
- [[Plan-Migration-Skills-Runtime-v1]] — doctrine prompt ≠ code
- [[État-du-Système-de-Skills]] — inventaire ADR-007
- Schéma : \`server/src/agent/contracts/skillMeta.schema.json\` (v1.6)

> **Note** : \`.github/skills/\` = vestiges IDE Cursor — conservés, non chargés par la plateforme (\`AGENTS.md\` §2.3).

## Tests CI

\`\`\`bash
cd server && npm run test:skills
cd server && npm run premerge
\`\`\`

---

**Dernière validation CI** : ${dateLabel} — **${dashboard.summary.errors} errors, ${dashboard.summary.warnings} warnings**

*Hub régénéré par \`vault:sync\` — 1 skill actif max/tour (ADR-007 v1.6).*
`;
}

/**
 * Note Vault longue forme (spec module architecture).
 */
export function renderVaultModulesSkillsMarkdown(dashboard, skills) {
  const hubRelative =
    '[Hub SKILLS.md](../../../../server/data/skills/SKILLS.md)';
  const reportRelative =
    '[skills-dashboard.json](../../04-Operations/reports/skills-dashboard.json)';

  return `# Module — Skills Plateforme (Runtime Citadelle)

**Statut** : Actif | **Version hub** : v1.6 | **Généré** : ${dashboard.generatedAt}

## Liens

- Hub opérationnel : ${hubRelative}
- Télémétrie JSON : ${reportRelative}
- Schéma meta : \`server/src/agent/contracts/skillMeta.schema.json\`

## Synthèse

| Métrique | Valeur |
|----------|--------|
| Total skills | ${dashboard.summary.totalSkills} |
| Runtime-backed | ${dashboard.summary.runtimeBacked} |
| Prompt-only | ${dashboard.summary.promptOnly} |
| Sub-skills ADR-008 | ${dashboard.summary.subSkills} |
| Erreurs CI | ${dashboard.summary.errors} |
| Avertissements CI | ${dashboard.summary.warnings} |

## Couverture Vague 2

- PDF : ${dashboard.coverage.pdf}
- Egress : ${dashboard.coverage.egress}
- Memory : ${dashboard.coverage.memory}
- Quality : ${dashboard.coverage.quality}

## Index runtime-backed

${skills
  .filter((entry) => entry.meta.runtimeModules?.length > 0)
  .map((entry) => {
    const mods = entry.meta.runtimeModules
      .map((mod) => `${mod.path} → ${mod.exportName}`)
      .join('; ');
    return `- **${entry.name}** : ${mods}`;
  })
  .join('\n')}

## Sub-skills Obsidian (ADR-008)

Parent : \`skill-obsidian-governance\`

${skills
  .filter((entry) => entry.meta.parentSkillId)
  .map((entry) => `- \`${entry.name}\` ← parent \`${entry.meta.parentSkillId}\``)
  .join('\n')}

---

*Document généré automatiquement — ne pas éditer manuellement sans resync \`npm run vault:sync\`.*
`;
}

/**
 * @param {object} [options]
 */
export function syncVaultToSkillsHub(options = {}) {
  const skillsDir = options.skillsDir;
  const { skills } = loadSkills(skillsDir);
  const dashboard = generateSkillsDashboard(skillsDir);

  const hubPath = options.hubPath || SKILLS_HUB_PATH;
  const vaultModulesPath = options.vaultModulesPath || VAULT_MODULES_SKILLS_PATH;

  const hubMarkdown = renderSkillsHubMarkdown(dashboard, skills);
  const vaultMarkdown = renderVaultModulesSkillsMarkdown(dashboard, skills);

  fs.mkdirSync(path.dirname(hubPath), { recursive: true });
  fs.mkdirSync(path.dirname(vaultModulesPath), { recursive: true });

  fs.writeFileSync(hubPath, hubMarkdown, 'utf-8');
  fs.writeFileSync(vaultModulesPath, vaultMarkdown, 'utf-8');

  return {
    hubPath,
    vaultModulesPath,
    dashboard,
    skills,
  };
}

export default syncVaultToSkillsHub;
