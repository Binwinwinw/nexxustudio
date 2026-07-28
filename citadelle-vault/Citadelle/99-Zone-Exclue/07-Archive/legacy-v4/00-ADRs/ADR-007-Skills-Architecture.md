# ADR-007 : Skills Architecture (Citadelle)

**Statut** : Actif
**Version** : 1.0

## Contexte
Le prompt système devient trop dense. Il est nécessaire de modulariser les compétences procédurales pour garantir la précision des sorties et la scalabilité du système.

## Décision
Implémentation d'un système de **Skills** (Compétences) chargés à la demande.
Un Skill est un ensemble de règles, checklists et méthodes spécialisées stocké dans `server/data/skills/`.

## Structure d'un Skill
- `meta.json` : Nom, version, déclencheurs (intentions).
- `SKILL.md` : Le cœur de la compétence (règles et méthodes).
- `checklist.md` : Critères de validation du livrable.

## Priorités de Chargement
1. **Noyau** (Toujours présent) : Identité, lois, continuité.
2. **Skill** (Conditionnel) : 1 skill actif max par tour.
3. **Mémoire** (Contextuel) : Documents projet, ADR, archives.

## Conséquences
- Réduction de la latence (prompts plus courts).
- Spécialisation accrue des agents.
- Débogage facilité par l'isolation des compétences.
