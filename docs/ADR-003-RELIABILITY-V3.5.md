# ADR-003 : Operational Reliability Recalibration (v3.5)

**Date** : 11 Mai 2026  
**Status** : Approved / In Implementation  
**Deciders** : Nexxus Assistant & User  

## Context
Nexxus Citadel v3.4 exhibits a pattern of "Epistemic Indiscipline": producing plausible but unproven information, confusing Blueprints (plans) with Builds (physical files), and hallucinating tools or project structures. This undermines the "Sovereign Proof" principle of the Citadel.

## Decision
We implement a 10-task "Factual Rigor" recalibration focusing on the following principles:
1. **Proof-First Affirmation**: Strict prohibition of claim verbs without explicit proof suffixes.
2. **Structural Duality**: Forced separation of Observed (Physical), Deduced (Conceptual), and Recommended (Actionable) information.
3. **Internal Verification**: Introduction of a "Critic Agent" and "Syntax Proxy" to catch hallucinations before emission.
4. **SMAC Gating**: Using confidence thresholds (0.75-0.95) as active publication gates.

## Tasks (Vague 1 — Immédiate)
1. **Verrouillage du langage** : Interdiction des affirmations sans preuves.
2. **Structure d'Output** : Contrat `OBSERVÉ / DÉDUIT / RECOMMANDÉ`.
3. **Sources de Vérité** : Priorité absolue aux fichiers `handoff`, `package.json`, `ADRs`.
4. **Agent Critique** : Pass de vérification interne post-génération.
5. **Tool Registry** : Interdiction des outils fantômes.
6. **Syntax Proxy** : Validation syntaxique du code proposé.
7. **Hiérarchie Blueprint/Build** : Distinction claire entre théorie et réalité.
8. **Portes SMAC** : Publication modulée par le score de confiance.
9. **Court-Circuit de Discordance** : Re-planification forcée en cas de contradiction doc/réponse.
10. **Suite de Régression** : 50 cas de tests de fiabilité.

## Consequences
- **Positive**: Drastic reduction in hallucinations, higher trust in recommendations, better alignment with codebase reality.
- **Negative**: Potential increase in response latency (due to verification steps), more "Unknown" labels in responses.

---
*Fait à La Citadelle.* 🏛️🛡️
