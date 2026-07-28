# Plan de migration — Skills procéduraux vs code runtime

**Date** : 27/05/2026  
**Clôture** : 30/05/2026  
**Statut** : **Terminé**  
**Portée** : Nexxus Studio / La Citadelle v4.5+  
**Références** : [[État-du-Système-de-Skills]], [[Synthèse-Migration-Skills-Runtime]], ADR-007, `AGENTS.md` §2.3

---

## 1. Problème (résolu)

Le dossier `server/data/skills/` mélangeait deux rôles sans traçabilité explicite :

| Couche | Rôle | Exemple |
|--------|------|---------|
| **Skill procédural** | Instructions injectées dans le prompt LLM | `skill-egress-security/SKILL.md` |
| **Module runtime** | Code exécuté par Node | `tool-output-sanitizer.js` |

La migration a doté La Citadelle de **23 skills plateforme**, dont **15 runtime-backed**, avec CI v1.6.

**Hors scope** : les skills workspace IDE (`.github/skills/`, Cursor) — **conservés, non supprimés**, non chargés par la plateforme.

---

## 2. Doctrine cible (en vigueur)

```
┌─────────────────────────────────────────────────────────────┐
│  SKILL (prompt)          RUNTIME (code)                     │
│  ─────────────           ──────────────                     │
│  Quoi / quand / KPI  →   Comment / où / tests               │
│  skillMeta.schema      →   package.json + tests Node        │
│  skillLoader.js        →   import explicite dans pipeline  │
└─────────────────────────────────────────────────────────────┘
```

**Règle** : tout skill fail-closed (sécurité, parsing, egress) **doit** référencer un module runtime testé.

---

## 3. État final inventaire (30/05/2026)

| Skill ID | Runtime | Module(s) clés |
|----------|---------|----------------|
| `skill-pdf-extraction` | ✅ | `pdf-extractor.js` |
| `skill-egress-security` | ✅ | `tool-output-sanitizer.js` |
| `skill-memory-governance` | ✅ | `curatedMemoryGate.js` |
| `skill-quality-gate` | ✅ | `quality-gate.js` |
| `skill-wiki-compiler` | ✅ | `wiki_compiler.js` |
| `skill-mcp-bridge` | ✅ | `mcp-bridge.js` |
| `skill-hybrid-retrieval` | ✅ | `hybrid-retrieval.js` |
| `skill-obsidian-governance` | ✅ | `ingest_wiki_adrs.js`, `wiki_compiler.js` |
| 8 skills procéduraux | 🔵 | `requiresRuntime: false` |

Dashboard live : `npm run dashboard:skills` — JSON : `04-Operations/reports/skills-dashboard.json`

---

## 4. Phases de migration

### Phase A — Traçabilité ✅

Schéma v1.5+, `validate_skill_runtime.js`, `npm run test:skills`

### Phase B — Wiki ESM ✅

`server/src/wiki/wiki_compiler.js`, `ingest_wiki_adrs.js`

### Phase C — Loader v1.6 ✅

`skillRuntimeRegistry.js`, audit runtime, `dashboard-skills.js`

### Phase D — Hub ↔ Vault ✅

`SKILLS.md` régénéré, `vault:sync`, export JSON

### Phase E — MCP + hybrid retrieval ✅

`skill-mcp-bridge`, `skill-hybrid-retrieval`

### Phase F — ~~Épuration `.github/skills/`~~ ❌ **Annulée**

Décision 30/05/2026 : la migration visait les skills **plateforme**, pas la suppression des vestiges IDE. `.github/skills/` reste en place.

Doc onboarding : [[Synthèse-Migration-Skills-Runtime]]

---

## 5. Checklist par nouveau skill

- [ ] `meta.json` conforme schéma v1.6
- [ ] `SKILL.md` + triggers + `doNotUseWhen`
- [ ] Module runtime si fail-closed
- [ ] Tests + `npm run test:skills`
- [ ] `npm run vault:sync`

---

## 6. Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Skill désactivé mais runtime actif | `SKILLS_DISABLED` n'affecte que le prompt ; runtime sécurité reste actif |
| Confusion IDE vs plateforme | `AGENTS.md` §2.3 + cette procédure |
| Régression silencieuse | `npm run premerge` (79 tests) |

---

## 7. Backlog post-migration (optionnel)

- `skill-epistemic-refusal` — procédural, non bloquant
- Alias cosmétique `runtime/egress-sanitizer.js`

---

*Migration clôturée 30/05/2026 — procédure opérationnelle.*
