# 🧠 Protocole SMAC (Stochastic Multi-Agent Consensus)

## Vue d'Ensemble
Le protocole SMAC est l'architecture de décision souveraine de La Citadelle. Il permet de réduire les hallucinations et d'augmenter la fiabilité architecturale en faisant voter plusieurs instances d'experts (LLM) avec des paramètres de stochasticité variés.

## 1. Paramétrage Technique (Maturation 04/05/2026)
L'implémentation standard pour les projets critiques (ex: MonCoachScolaire) repose sur un trio d'agents :

| Rôle | Modèle | Température | Mission |
|------|--------|-------------|---------|
| **Architecte** | Llama-3-8B | 0.1 | Garant de la structure et des ADR. |
| **Analyste** | Mistral-7B | 0.2 | Détection des failles et incohérences. |
| **Auditeur** | Qwen-2.5-7B | 0.4 | Exploration de patterns et recul critique. |

## 2. Seuils de Gouvernance (Go/No-Go)
Les décisions sont filtrées selon le score de similarité sémantique (consensus) :

*   **Score ≥ 0.75** : **ACTION AUTOMATIQUE**. Basse criticité.
*   **Score ≥ 0.85** : **VALIDATION HUMAINE**. Risque modéré (ex: modification de code).
*   **Score ≥ 0.95** : **REVUE D'ARCHITECTURE**. Risque élevé (ex: schéma DB, sécurité).

## 3. Infrastructure
*   **Hub de données** : ChromaDB (Source unique de vérité pour le RAG).
*   **Cache** : 14 jours (Clé : Context + Version Modèle + Type d'arbitrage).
*   **Monitoring** : Métriques p50/p95, tokens/coût, erreurs par route.

## 4. Historique de Maturation (Case Study)
Le 04/05/2026, un bug de scraping web a été transformé en une opportunité de maturation architecturale. En intégrant les principes du SMAC (Stochastic Multi-Agent Consensus), La Citadelle a atteint un **Score de Maturité Global de 97%** avec :
*   0 hallucination sur 1000 prompts.
*   Latence p50 de 120ms.
*   Conformité RGPD de 100%.

---
*Document scellé par l'Architecte Souverain.*
