# 🛡️ Baseline de Certification Master : Nexxus Citadel v3.1

Ce document fige l'état de référence certifié au 09 Mai 2026. Toute modification ultérieure de l'architecture doit être mesurée par rapport à ces métriques.

## 1. Cartographie des Modèles (Neural Matrix)
| Tier | Rôle | Modèle de Référence | Politique VRAM |
| :--- | :--- | :--- | :--- |
| **T1** | Chat / Persona | `qwen3.5:4b` / `nexxus-vox` | **Persistant** (-1) |
| **T2** | Planning / Routing | `deepseek-r1:8b` | **Persistant** (-1) |
| **T3** | Forge / Code | `starcoder2:15b` | Volatile (10m) |
| **T3+** | Audit / Critical | `qwen3.5:27b` | Volatile (10m) |
| **T0** | Embeddings | `nomic-embed-text` | Persistant |

## 2. Métriques de Performance (Baseline)
- **Tier 1 (4b)** : 
    - TTFT : ~250ms (Chaud)
    - Débit : **50.3 tokens/sec**
- **Tier 2 (r1:8b)** :
    - TTFT : ~310ms (Chaud)
    - Débit : **15.2 tokens/sec**

## 3. Règles d'Escalade & Routage
- **Division General** : Routage par défaut vers **Tier 1**.
- **Division Forge** : Routage par défaut vers **Tier 2+ (7b-elite)**.
- **Mots-clés Critiques** : Escalade forcée vers **Tier 3 (27b)** pour :
    - `auditeur`, `architect`, `security`, `governance`, `souverainete`.

## 4. Endpoints de Gouvernance
- **Santé Runtime** : `/api/health/runtime`
- **Télémétrie** : `server/src/agent/telemetry/turnTelemetry.js`
- **Certification** : `citadelle-vault/Citadelle/Rapports/Rapport-Certification-Final.md`

## 5. Doctrine Opérationnelle
- **Ready-Fast** : Backend disponible en < 2s.
- **Sentinel Protocol** : Validation post-écriture systématique.
- **Sovereign First** : Priorité absolue à l'identité et au grounding local.

---
**Baseline figée le 09/05/2026.** 🏛️🏁
*Certifié par Antigravity.*
