# Stratégie de Réceptivité & Warmup : "Ready-Fast" v3.1

Ce document définit la doctrine de disponibilité et de spécialisation des modèles au sein de Nexxus Citadel.

## 1. Doctrine "Ready-Fast"
Le backend de La Citadelle est disponible **immédiatement** (T < 2s). L'intelligence est ensuite injectée par une cascade asynchrone de préchauffage (Warmup) répartie en 4 Tiers.

### Cascade de Préchauffage :
1. **Tier 1 (Instant)** : `qwen3.5:4b` + `nexxus-vox` + `nomic-embed-text`.
   - **Objectif** : Accueil utilisateur, identité souveraine et RAG immédiat.
2. **Tier 2 (Stratège)** : `deepseek-r1:8b`.
   - **Objectif** : Planning et routage analytique.
3. **Tier 3 (Usine - Background)** : `starcoder2:15b` + `qwen3.5:27b`.
   - **Objectif** : Production lourde et audit critique.

## 2. Spécialisation par Nature (Thinkers vs Actors)
La Citadelle distingue désormais la **Raison** de l'**Action**.

| Nature | Modèles Clés | Comportement |
| :--- | :--- | :--- |
| **THINKERS** | `deepseek-r1:8b`, `27b` | Priorité au raisonnement `<think>`. Analyse profonde, audit, stratégie. |
| **ACTORS** | `starcoder2:15b`, `ornith:9b` | Priorité à la sortie directe. Génération de fichiers, scripts, discussion fluide. |

## 3. Performances Benchmarkées (Mai 2026)
| Modèle | Tier | TTFT (ms) | Débit (tok/s) | Rôle Optimal |
| :--- | :---: | :---: | :---: | :--- |
| **qwen3.5:4b** | 1 | ~250 | **50.3** | Tour de Contrôle / Chat |
| **deepseek-r1:8b** | 2 | ~310 | 15.2 | Planning / Routing |
| **qwen3.5:27b** | 3 | ~67000* | 11.2 | Audit Lourd / Forge |

*\* Temps incluant le chargement VRAM "On-Demand".*

## 4. Gestion VRAM Hybride
- **Persistent** : Tier 1 & Tier 2 restent résidents en VRAM pour une réactivité "Zéro Latence".
- **Volatile** : Tier 3 (Heavy) utilise une politique de `keep_alive: 10m` pour libérer les ressources GPU automatiquement après usage.

---
**Certification v3.1** : Optimisation validée par tests de routage en conditions réelles. 🛡️🏛️🏁
