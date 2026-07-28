# Hub des Skills — La Citadelle

> **Version** : v1.6 | **Dernière mise à jour** : 30/05/2026 02:41 | **Total skills** : 26
>
> **Plateforme uniquement** — skills runtime `server/data/skills/`. Les skills workspace IDE (Cursor, Copilot) ne sont **pas** chargés ici. Voir `AGENTS.md` §2.3.

## Dashboard en direct

```bash
cd server && npm run dashboard:skills
cd server && npm run ops:full
```

**État actuel** (2026-05-30T06:41:20.493Z) :

- 🟢 Runtime-backed: **18** skills
- 🔵 Prompt-only: **8** skills
- 🧩 Sub-skills: **4** skills
- ❌ Errors: **0** | ⚠️ Warnings: **0**

## Couverture Vague 2

| Skill | Nom | Runtime principal | Statut |
|-------|-----|-------------------|--------|

| [[skill-pdf-extraction]] | PDF Extraction | `pdf-extractor.js` | ✅ |
| [[skill-egress-security]] | Egress Security | `tool-output-sanitizer.js` | ✅ |
| [[skill-memory-governance]] | Memory Governance | `curatedMemoryGate.js` | ✅ |
| [[skill-quality-gate]] | Quality Gate | `quality-gate.js` | ✅ |

## Arborescence des skills

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
└── … (22 autres dossiers skill-*)

## Navigation par catégorie

### Priorité haute (Vague 2)

- [[skill-pdf-extraction]] — Extraction texte PDF local-first avec limites honnêtes (pas d'OCR par défaut).
- [[skill-egress-security]] — Sécurité sortante unifiée : anti-SSRF, egress fail-closed, sanitisation sorties web (OWASP ASI-03).
- [[skill-memory-governance]] — Promotion mémoire, curated gate, TTL, conflits et décisions autoritaires — gouvernance mémoire long terme.
- [[skill-quality-gate]] — Checklist pre-livraison : test:stability, security audit local, quality-gate avant merge.

### Obsidian — parent + sub-skills (ADR-008)

- [[skill-obsidian-governance]] — parent Vault / wiki / ingestion ADR
- [[skill-obsidian-canvas]] — Sub-skill: fichiers .canvas Obsidian (JSON natif, nœuds et arêtes).
- [[skill-obsidian-cli]] — Sub-skill: automatisation via CLI Obsidian (list, search, walk).
- [[skill-obsidian-markdown]] — Sub-skill: traitement Markdown Obsidian (wikilinks, callouts, frontmatter YAML).

### Runtime-backed (autres)

- [[skill-007-orchestrator]] — Règles d'or de l'assistant pour le développement de haute précision.
- [[skill-conversation-stability]] — Stabilité conversationnelle, streaming, contrats de réponse, régressions et health score.
- [[skill-document-analysis]] — Analyse structurée de documents joints (texte, code, logs) avec briefing, streaming et fallback document-aware.
- [[skill-egress-security]] — Sécurité sortante unifiée : anti-SSRF, egress fail-closed, sanitisation sorties web (OWASP ASI-03).
- [[skill-epistemic-refusal]] — Dire « je ne sais pas » vs fallback document — complète conversation-stability (fail-closed).
- [[skill-hybrid-retrieval]] — BM25 + vecteur (knowledgeHub) + RRF + rerank — au-delà de rag-ingestion.
- [[skill-intent-routing]] — Routage d'intention, contrats v1.2, bypass SIMPLE_FAST et sélection orchestrateur vs fast path.
- [[skill-micro-delestage]] — Couche micro P1–P4 : short-circuit, familiarité trois temps, interprète requête P4 (ADR-20260601).
- [[skill-makers-checker]] — Double validation : 2 agents vérifient 1 décision — réduit hallucinations (fail-closed).
- [[skill-mcp-bridge]] — Standardiser outils externes sans cloud critique (serveurs MCP locaux).
- [[skill-memory-governance]] — Promotion mémoire, curated gate, TTL, conflits et décisions autoritaires — gouvernance mémoire long terme.
- [[skill-nexxus-design]] — Création DA / design system / composants / blueprint Forge-ready (DESIGN_CREATE).
- [[skill-impeccable]] — Audit qualité UI/UX : score, issues, quick wins, blockers (DESIGN_AUDIT).
- [[skill-design-extract]] — Rétro-ingénierie visuelle : ADN site, tokens, patterns (DESIGN_EXTRACT).
- [[skill-nexxus-video]] — Intelligence vidéo multimodale (scènes, transcript, OCR, evidence pack) — job async local-first.
- [[skill-obsidian-governance]] — Gouvernance Obsidian (parent ADR-008) — Vault, wiki, ingestion ADR et sub-skills Markdown/canvas/CLI.
- [[skill-pdf-extraction]] — Extraction texte PDF local-first avec limites honnêtes (pas d'OCR par défaut).
- [[skill-quality-gate]] — Checklist pre-livraison : test:stability, security audit local, quality-gate avant merge.
- [[skill-rag-ingestion]] — Indexation intelligente et chunking AST-aware du workspace.
- [[skill-telemetry-observability]] — Monitoring agent, métriques runtime, alertes — production ops.
- [[skill-upload-security]] — Garde-fous upload Multer, double extension, MIME, messages UPLOAD_REJECTED et fail-closed.
- [[skill-vision-sota]] — Pipeline d'analyse visuelle discipliné pour interfaces et documents.
- [[skill-wiki-compiler]] — Compilation et structuration du Vault Obsidian en graphe de connaissances.

### Backlog (pending — non déployés)

- [[skill-request-interpreter]] — **Candidat P4** : interprète requête fragile (normaliser, hypothétiser, clarifier). Implémenté en micro-couche ; `enabled: false` jusqu'à observation terrain.

### Priorité moyenne (Phase E)

- [[skill-hybrid-retrieval]] — BM25 + vecteur (knowledgeHub) + RRF + rerank — au-delà de rag-ingestion.
- [[skill-mcp-bridge]] — Standardiser outils externes sans cloud critique (serveurs MCP locaux).

## Skills procéduraux (prompt-only)

Ces skills n'ont **pas de module runtime JavaScript** déclaré — procédures injectées dans le prompt :

| Skill | requiresRuntime | Description |
|-------|-----------------|-------------|

| skill-architecture-review | `false` | Compétence d'inventaire et de priorisation de la dette technique par module. |
| skill-audit-sota | `false` | Compétence d'expertise pour certifier la sécurité, la conformité et la performance des modules. |
| skill-industrial-maturation | `false` | Capacité d'indexation, de benchmarking et d'arbitrage SMAC sur des dépôts de code locaux. |
| skill-obsidian-canvas | `false` | Sub-skill: fichiers .canvas Obsidian (JSON natif, nœuds et arêtes). (parent: skill-obsidian-governance) |
| skill-obsidian-cli | `false` | Sub-skill: automatisation via CLI Obsidian (list, search, walk). (parent: skill-obsidian-governance) |
| skill-obsidian-markdown | `false` | Sub-skill: traitement Markdown Obsidian (wikilinks, callouts, frontmatter YAML). (parent: skill-obsidian-governance) |
| skill-sentinel-verify | `false` | Protocole de vérification post-modification pour garantir l'intégrité technique. |
| skill-ui-forge | `false` | **Deprecated** → [[skill-nexxus-design]] + [[skill-impeccable]]. |

## Métriques KPI (Vague 2)

| Skill | triggerAccuracyTarget | fallbackRateMax |

|-------|----------------------|-----------------|

| skill-pdf-extraction | 0.88 | — |
| skill-egress-security | 0.9 | — |
| skill-memory-governance | 0.85 | — |
| skill-quality-gate | 0.88 | 0.05 |

## Désactivation (feature flag)

```bash
SKILLS_DISABLED=skill-pdf-extraction,skill-quality-gate
```

Fallback : `fallbackSkillId` dans `meta.json` (ex. PDF → `skill-document-analysis`).

## Synchronisation Vault

Ce hub est synchronisé avec :

- [modules/skills.md](../../../citadelle-vault/Citadelle/02-Architecture/modules/skills.md)
- [reports/skills-dashboard.json](../../../citadelle-vault/Citadelle/04-Operations/reports/skills-dashboard.json)

```bash
cd server && npm run vault:sync
```

## Documentation associée

- [[Synthèse-Migration-Skills-Runtime]] — onboarding équipe (migration clôturée)
- [[Plan-Migration-Skills-Runtime-v1]] — doctrine prompt ≠ code
- [[État-du-Système-de-Skills]] — inventaire ADR-007
- Schéma : `server/src/agent/contracts/skillMeta.schema.json` (v1.6)

> **Note** : `.github/skills/` = vestiges IDE Cursor — conservés, non chargés par la plateforme (`AGENTS.md` §2.3).

## Tests CI

```bash
cd server && npm run test:skills
cd server && npm run premerge
```

---

**Dernière validation CI** : 30/05/2026 02:41 — **0 errors, 0 warnings**

*Hub régénéré par `vault:sync` — 1 skill actif max/tour (ADR-007 v1.6).*
