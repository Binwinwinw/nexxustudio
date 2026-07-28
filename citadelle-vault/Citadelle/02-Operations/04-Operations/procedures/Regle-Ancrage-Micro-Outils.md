# Règle d'ancrage minimum — micro-outils P1/P2/P3

> **Version** : 1.0 | **Date** : 01/06/2026 | **Statut** : Actif

## Objectif

Tout nouveau **micro-outil** (délestage conversationnel, prep documentaire, ops/gouvernance) doit être **câblé dès sa création** au Vault, au runtime et à l'observabilité — jamais « rattrapé plus tard ».

Doctrine : *complexifier un peu le système documentaire pour ne plus dépendre de la mémoire implicite de l'agent.*

## Périmètre

S'applique à toute brique ajoutée sous `server/src/agent/micro/` ou équivalent déterministe amont du pipeline LLM, classée **P1**, **P2** ou **P3**.

| Priorité | Exemples |
|----------|----------|
| **P1** | Conversation : identité, idéation, familiarité, social |
| **P2** | Document : prep RAG, fallback briefing, pièces jointes |
| **P3** | Ops : telemetry hints, health gates, warmup hints |

## Ancrage minimum (obligatoire)

Avant merge, **cinq ancrages** doivent exister :

| # | Ancrage | Livrable | Emplacement type |
|---|---------|----------|------------------|
| 1 | **Pack** | Module dans un pack micro (`normalization`, `classifiers`, `replies`, …) | `server/src/agent/micro/` |
| 2 | **Point d'entrée pipeline** | Appel explicite amont LLM (short-circuit ou gate) | `agentPipeline.js`, `intentShortCircuit.js`, … |
| 3 | **Tests** | Fichier dédié + 0 fail en CI | `server/tests/*.test.js` |
| 4 | **Doc module** | Spec architecture + taxonomie si applicable | `02-Architecture/modules/` |
| 5 | **Impact ops** | Playbook smoke / checklist reproductible | `04-Operations/procedures/` |

### Documentation Vault (recommandé dès P1)

| Niveau | Quand | Emplacement |
|--------|-------|-------------|
| **ADR** | Changement de doctrine ou nouvelle capacité institutionnelle | `02-Architecture/adr/` |
| **Skill runtime** | Comportement branché au pipeline | `server/data/skills/skill-*/` |
| **Hub SKILLS** | Entrée navigation | `server/data/skills/SKILLS.md` |

Les WikiLinks doivent croiser : ADR ↔ module ↔ playbook ↔ skill.

## Checklist merge (copier-coller)

```markdown
- [ ] Pack micro créé ou étendu (`micro/<pack>/`)
- [ ] Point d'entrée pipeline documenté et câblé
- [ ] Tests dédiés passent (0 fail)
- [ ] Module Vault `02-Architecture/modules/<Nom>.md`
- [ ] Playbook ops `04-Operations/procedures/Playbook-<Nom>.md`
- [ ] Skill runtime + `meta.json` + entrée SKILLS.md (si P1)
- [ ] ADR si nouvelle doctrine (sinon lien vers ADR existant)
- [ ] Télémétrie : path `*_deterministic` ou équivalent tracé
```

## Interdictions

- Micro-outil **sans test** → refus merge.
- Logique dupliquée hors `micro/` + guard source unique → refactor obligatoire.
- Lexique / règle métier compensée par prompt LLM → anti-pattern.

## Référence modèle

Premier exemplaire complet : [[ADR-20260601-Micro-Conversation-Delestage]] + [[Micro-Conversation-Delestage]] + [[Playbook-Micro-Delestage-Conversationnel]] + [[skill-micro-delestage]].

## Liens

- [[ADR-20260601-Micro-Conversation-Delestage]]
- [[Playbook-Micro-Delestage-Conversationnel]]
- [[Micro-Conversation-Delestage]]
