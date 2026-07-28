# Synthèse — Skills runtime La Citadelle (onboarding équipe)

**Date** : 30/05/2026  
**Statut** : Migration **terminée**  
**Public** : nouvelle équipe, ops, agents IA  
**Références** : [[Plan-Migration-Skills-Runtime-v1]], `AGENTS.md` §2.3, hub `server/data/skills/SKILLS.md`

---

## 1. Deux registres de skills (ne pas confondre)

| Registre | Emplacement | Rôle | Action |
|----------|-------------|------|--------|
| **Plateforme Citadelle** | `server/data/skills/` | Skills runtime + prompts injectés par `skillLoader` | **Source de vérité ops** |
| **Workspace IDE** | `.github/skills/`, Cursor `skills-cursor/` | Vestiges / skills éditeur (babysit, canvas, create-rule…) | **Gardés — ne pas supprimer, non chargés par Nexxus** |

Doctrine : un skill Cursor **n'est pas** un skill plateforme. Voir `AGENTS.md` §2.3.

---

## 2. État final (30/05/2026)

| Métrique | Valeur |
|----------|--------|
| Total skills plateforme | **24** |
| Runtime-backed | **16** (67 %) |
| Prompt-only (`requiresRuntime: false`) | **8** (33 %) |
| Sub-skills Obsidian (ADR-008) | **3** (+ `skill-hybrid-retrieval` enfant de RAG) |
| Tests `npm run premerge` | **82/82 PASS** |
| CI `test:skills` | **0 errors, 0 warnings** |
| Schéma meta | **v1.6** (`runtimeModules`, `parentSkillId`, `subSkills`) |

---

## 3. Capacités livrées (vagues B → E)

| Domaine | Skill | Module runtime principal |
|---------|-------|--------------------------|
| PDF | `skill-pdf-extraction` | `server/src/services/pdf-extractor.js` |
| Egress / ASI-03 | `skill-egress-security` | `server/src/services/tool-output-sanitizer.js` |
| Mémoire | `skill-memory-governance` | `curatedMemoryGate.js`, `memoryPromotionPolicy.js` |
| Qualité CI | `skill-quality-gate` | `server/src/quality/quality-gate.js` |
| Wiki Vault | `skill-wiki-compiler` | `server/src/wiki/wiki_compiler.js` |
| Obsidian | `skill-obsidian-governance` + 3 sub-skills | `server/src/wiki/ingest_wiki_adrs.js` |
| MCP local | `skill-mcp-bridge` | `server/src/mcp/mcp-bridge.js` |
| RAG hybride | `skill-hybrid-retrieval` | `server/src/retrieval/hybrid-retrieval.js` |
| Refus épistémique | `skill-epistemic-refusal` | `modeResponseContracts.js` (`evaluateEpistemicRefusal`) |

Couverture Vague 2 critique : **PDF ✅ Egress ✅ Memory ✅ Quality ✅**

---

## 4. Commandes essentielles

```bash
cd server

npm run dashboard:skills    # Vue ops prompt-only vs runtime-backed
npm run test:skills         # Validation meta.json v1.6 + exports
npm run premerge            # Skills + régressions critiques (79 tests)
npm run vault:sync          # Hub SKILLS.md + Vault modules + JSON rapport
npm run ops:full            # Dashboard + sync + test:skills
npm run quality:gate        # Gate pre-livraison (stabilité + KPI)
```

Désactiver un skill prompt (sans retirer le runtime sécurité) :

```bash
SKILLS_DISABLED=skill-pdf-extraction,skill-quality-gate
```

---

## 5. Architecture loader (v1.6)

```
server/data/skills/skill-*/meta.json
        ↓
skillLoader.js (intent-first, doNotUseWhen, fallbackSkillId)
        ↓
skillRuntimeRegistry.js (audit RUNTIME_MISSING au boot)
        ↓
Modules runtime (services/, quality/, wiki/, mcp/, retrieval/)
```

Hub régénéré : **ne pas éditer `SKILLS.md` à la main** — lancer `npm run vault:sync`.

Artefacts Vault :
- `citadelle-vault/Citadelle/02-Architecture/modules/skills.md`
- `citadelle-vault/Citadelle/04-Operations/reports/skills-dashboard.json`

---

## 6. Ajouter un nouveau skill plateforme

1. Créer `server/data/skills/skill-<id>/` : `meta.json`, `SKILL.md`, `checklist.md`
2. Si garde-fail fail-closed : module runtime + `testFiles` + `requiresRuntime: true`
3. Si procédural pur : `runtimeModules: []` + `requiresRuntime: false`
4. Valider : `npm run test:skills` puis `npm run premerge`
5. Sync : `npm run vault:sync`

Checklist détaillée : [[Plan-Migration-Skills-Runtime-v1]] §5.

---

## 7. Backlog optionnel (hors migration)

| Item | Statut |
|------|--------|
| Alias `runtime/egress-sanitizer.js` | Cosmétique — `tool-output-sanitizer.js` suffit |

**Migration skills : 24/24 — clôturée** (30/05/2026).

**Phase F annulée** : aucune épuration de `.github/skills/` — registre IDE conservé tel quel.

---

## 8. Phases accomplies

| Phase | Contenu | Statut |
|-------|---------|--------|
| A | Schéma v1.5+, CI `validate_skill_runtime.js` | ✅ |
| B | Wiki ESM (`server/src/wiki/`) | ✅ |
| C | Loader v1.6 + dashboard ops | ✅ |
| D | Hub SKILLS.md ↔ Vault | ✅ |
| E | MCP bridge + hybrid retrieval | ✅ |
| F | ~~Cleanup `.github/skills/`~~ | ❌ **Annulée** (non requis) |

---

*Document de clôture migration — La Citadelle / Nexxus Studio.*
