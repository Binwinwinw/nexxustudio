---
name: audit-repo
description: Audit structurel et qualitatif du repo MonCoachScolaire. Utiliser pour verifier la coherence des contextes, instructions, skills, prompts, agents et conventions de patch avant implementation.
argument-hint: "zone a auditer, objectif"
---

# Skill — Audit Repo

## Objectif

Verifier rapidement que le repo est coherent sur:

- architecture de personnalisation Copilot
- conventions projet
- risques de divergence entre docs, skills et instructions
- pre-requis avant patchs importants

## Quand utiliser

- avant un lot de refactor
- avant creation de nouveaux skills/agents/prompts
- quand Copilot semble ignorer une regle
- quand plusieurs sources documentaires se contredisent

## Checklist d'audit

1. Verifier les points d'entree contexte:

- `.github/copilot-instructions.md`
- `.github/PROJECT_CONTEXT.md`
- `CONTEXT_INDEX.md`

2. Verifier la coherence des instructions:

- `.github/instructions/*.md`
- presence de `applyTo`
- descriptions explicites

3. Verifier les skills:

- dossier `.github/skills/<name>/SKILL.md`
- frontmatter valide
- `name` identique au nom du dossier
- description precise (quand utiliser)

4. Verifier les agents:

- dossier `.github/agents/`
- fichiers `*.agent.md`
- frontmatter minimal coherent
- handoffs non circulaires inutiles

5. Verifier les prompts:

- `.github/prompts/*.prompt.md`
- non-redondance avec skills/instructions

6. Verifier les conventions de livraison:

- diff minimal
- tests/repro steps
- rollback simple

## Sortie attendue

Toujours produire:

- constats classes par severite
- fichiers concernes
- actions recommandees court terme
- actions recommandees moyen terme

## Format de resultat conseille

```text
CRITIQUE:
- ...

MAJEUR:
- ...

MINEUR:
- ...

PROCHAINES ACTIONS:
1. ...
2. ...
```
