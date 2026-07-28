# État du Système de Skills (v1.4)

> **Gouvernance** : [[02-Architecture/adr/ADR-007-Skills-Architecture|ADR-007]]
> **Statut** : 🟢 Opérationnel
> **Date** : 27/05/2026

## Architecture runtime

- **Hub** : `server/data/skills/SKILLS.md`
- **Schéma meta** : `server/src/agent/contracts/skillMeta.schema.json` (v1.4 : `doNotUseWhen`, `fallbackSkillId`, `enabled`, `kpis`)
- **Loader** : intent-first + trigger boost + exclusions + `SKILLS_DISABLED`
- **Tests déclenchement** : `tests/skillTriggerMatrix.test.js` (KPI accuracy ≥ 85 %)
- **PoC manuel** : `tests/manual/skill-poc-wave2.mjs`

### Désactivation

```bash
SKILLS_DISABLED=skill-pdf-extraction
```

## Skills actifs (18)

| ID | Nom | v | Notes |
|----|-----|---|-------|
| `skill-document-analysis` | Document Analysis | 1.0 | Texte/code joint |
| `skill-pdf-extraction` | PDF Extraction | 1.0 | Fallback → document-analysis |
| `skill-upload-security` | Upload Security | 1.0 | |
| `skill-intent-routing` | Intent Routing | 1.0 | |
| `skill-conversation-stability` | Conversation Stability | 1.0 | |
| `skill-egress-security` | Egress Security | 1.0 | Fusion ASI-03 + SSRF |
| `skill-memory-governance` | Memory Governance | 1.0 | |
| `skill-quality-gate` | Quality Gate | 1.0 | |
| `skill-007-orchestrator` | Coding Protocol | 1.0 | tier fallback |
| … | (6 skills forge/vault inchangés) | | audit, ui, vision, rag, wiki, obsidian, maturation, architecture, sentinel |

## Matrice gaps — post vague 2

| Besoin | Skill | Statut |
|--------|-------|--------|
| PDF procédural | `skill-pdf-extraction` | ✅ Skill + **`pdf-extractor.js`** câblé |
| Egress / ASI-03 | `skill-egress-security` | ✅ Skill (middleware code pending) |
| Memory governance | `skill-memory-governance` | ✅ Skill |
| Quality gate CI | `skill-quality-gate` | ✅ Skill |
| Sub-skills Obsidian | sous `obsidian-governance` | 🔶 ADR-008 |
| MCP bridge | — | 🔴 Reporté |
| Repo hygiene | — | 🔶 Basse priorité |

## KPI validation post-implémentation

| KPI | Mesure | Cible |
|-----|--------|-------|
| **triggerAccuracy** | `skillTriggerMatrix.test.js` | ≥ 85 % |
| **skills_count** | télémétrie `nexxus.prompt.skills_count` | 0 ou 1/tour |
| **falsePositiveRate** | cas `expectNot` matrice | ≤ 10 % |
| **fallbackRate** | logs fallbackSkillId | traçable |
| **gatePassRate** | `test:stability` avant release | 100 % |

## Review sécurité (checklist par skill)

- [ ] SKILL.md + checklist relus (pas de secrets)
- [ ] `doNotUseWhen` testé dans matrice
- [ ] Skills web/sécurité : revue OWASP ASI-03
- [ ] Feature flag `SKILLS_DISABLED` documenté

## Hors périmètre

Skills **workspace IDE** ≠ skills **plateforme** — voir `AGENTS.md` §2.3.

#gouvernance #skills #citadelle
