# Skill : Design Extract (v1.0)

## Mission

**Rétro-ingénierie visuelle** — capturer l'ADN complet d'un site : palette, typographie, grille, rayons, ombres, sections, ton éditorial, rythme, CTA, patterns composants, indices stack.

## Quand l'utiliser

- « Analyse ce site et récupère son ADN »
- « Fais-moi un dossier de référence de cette marque »
- « Reconstitue son design system »
- « Prépare un prompt de refonte fidèle à ce style »

## Signaux extraits (v1)

Palette, typographie, grille, radius, ombres, types de sections, ton éditorial, spacing, CTA, patterns composants, hints stack.

## Sorties (contrat v1)

| Artefact | Description |
|----------|-------------|
| `dna_dossier` | Synthèse structurée |
| `tokens` | Tokens dérivés |
| `patterns` | Composants / sections récurrents |
| `reproduction_prompt` | Prompt fidèle pour Nexxus Design |

## Gouvernance

- Egress `local-only` par défaut ; crawl contrôlé via `skill-egress-security`
- Fail-closed si page inaccessible ou signal insuffisant
- Job async pour crawl lourd — `POST /api/design/extract/jobs`

## Non-objectifs

- Création interface → `skill-nexxus-design`
- Audit polish → `skill-impeccable`

## Intent

`DESIGN_EXTRACT`

## Liens

- [[skill-egress-security]]
- [[skill-nexxus-design]] — consommateur typique de l'ADN extrait
