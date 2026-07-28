# Skill: AI Agent Architecture (Théorie Souveraine)

## Purpose
Encoder la théorie complète des agents IA en utilisant Nexxus Studio comme référence vivante.
Ce fichier est la base épistémique de la cognition autonome de Nexxus.

---

## 1. Les 4 Piliers d'un Agent IA (Le Cycle PARA)

```
[PERCEPTION] → [ANALYSE] → [RAISONNEMENT] → [ACTION]
      ↑                                          |
      └──────────── [MÉMOIRE] ──────────────────┘
```

### Implémentation dans Nexxus :
| Pilier        | Rôle dans Nexxus                          | Fichier référence                         |
|---------------|-------------------------------------------|-------------------------------------------|
| **Perception**| Réception de la query utilisateur         | `server/src/orchestration/agent.js` L.27  |
| **Analyse**   | Router Hybride BM25 + Sémantique          | `server/src/orchestration/expertRouter.js`|
| **Raisonnement**| LLM avec `<think>` (DeepSeek-R1)       | `agent.js` : boucle while + buffer L.86   |
| **Action**    | `<action>buildProject`, webSearch…        | `agent.js` : gestion actions L.179-253    |
| **Mémoire**   | SessionStore (court terme) + Cache (long) | `server/src/services/sessionStore.js`     |

---

## 2. Les Types de Mémoire d'un Agent

### Court terme (In-Context Window)
- `currentHistory[]` dans `agent.js` — l'historique de la conversation active.
- **Limite** : La taille du contexte du modèle (`num_ctx: 4096`).
- **Stratégie Nexxus** : Injection sélective de l'historique + system prompt.

### Long terme (Persisté sur Disque)
- `server/data/sessions/*.json` — Mémoire des conversations par session.
- `server/data/experts_cache.json` — Cache des vecteurs d'embeddings (288 Ko).
- **Stratégie Nexxus** : Sérialisation JSON + lecture à la demande.

### Sémantique (Base Vectorielle)
- `expertRouter.index{}` — Vecteurs d'embeddings des experts en mémoire RAM.
- Modèle d'embedding : `nomic-embed-text` (via Ollama local).
- **Stratégie Nexxus** : Hybride BM25 (lexical) + cosine similarity (sémantique) fusionnés via RRF.

---

## 3. Routage : L'Intelligence de la Délégation

Un agent souverain ne fait pas tout lui-même. Il délègue à l'expert optimal.

### Le pipeline de routage Nexxus (V7.4) :
```
Query → Embedding → [Cosine Similarity > 0.55 ?] → Branche Sémantique ┐
      → Tokenize → BM25 Score                    → Branche Lexicale   ├→ RRF Fusion → Top-5 → Master Orchestrator → Expert(s) Sélectionnés
```

### Principes clés :
1. **Seuil adaptatif** (`threshold: 0.55`) — Rejeter le bruit, garder la pertinence.
2. **Fusion RRF** (Reciprocal Rank Fusion) — Combiner deux signaux sans biais de magnitude.
3. **Arbitrage Cognitif** — Le `master_orchestrator` valide la sélection avec ~0.1 temperature pour neutralité maximale.
4. **Fallback gracieux** — Si l'orchestrateur échoue, on garde les 3 meilleurs candidats bruts.

---

## 4. La Boucle Agentique (Le Moteur de Réflexion)

Un agent puissant est un agent qui **itère** jusqu'à la validation, pas un agent qui répond en un coup.

### Boucle Nexxus (maxIterations: 5) :
```
Itération 1 : Génération → Vérification Auditeur
   └─ [VALIDÉ] → Retranscription Souveraine → FIN
   └─ [ÉCHEC]  → Critique injectée en historique → Itération 2 (Correction)
              → ...
              → Itération N : Génération corrigée → Vérification Auditeur
```

### Le Protocole Éveil :
- **SANDBOX FIRST** : Le build est simulé avant d'être réel (mode `dryRun: true`).
- **AUDIT OBLIGATOIRE** : Tout code généré est audité par `expert_auditeur` (`llama:8b-elite`).
- **CORRECTION FORCÉE** : L'échec d'audit relance la boucle avec la critique comme contexte.

---

## 5. Le Dual-Model Pattern (Penseur + Voix)

Séparer la **cognition profonde** de la **communication** est une architecture de haute maîtrise.

| Rôle       | Modèle            | Rôle précis                                    |
|------------|-------------------|------------------------------------------------|
| **Penseur**| `deepseek-r1:14b` | Raisonnement profond avec `<think>` extended   |
| **Voix**   | `ornith:9b`       | Retranscription naturelle, charismatique (T=0.3)|

**Pourquoi ?** Le modèle de reasoning produit du texte verbeux et technique.
Le modèle de voix le transforme en communication souveraine, directe et élégante.

---

## 6. Principes de Conception d'un Contrat Expert (Expert Contract)

Un expert n'est pas un "rôle". C'est un **contrat d'exécution** avec :

```json
{
  "key": "identifiant_unique",
  "name": "Nom affiché",
  "description": "Ce que fait cet expert (pour le routeur sémantique)",
  "when_to_use": ["triggers", "cas d'usage"],
  "scope": "Périmètre strict (ce qu'il fait ET ce qu'il ne fait PAS)",
  "model": "modèle_optimal_pour_cette_tâche",
  "prompt": "Contrat d'exécution : INTERDICTIONS, SORTIES ATTENDUES, FORMAT",
  "tier": "ELITE | STANDARD"
}
```

### Règle d'Or : Le prompt = le cahier des charges, pas la narration.
- ❌ "Tu es un expert passionné par..."
- ✅ "RÈGLES : Pas de verbosité. SORTIE : 1) Architecture, 2) Code, 3) Risques."

---

## 7. Gestion VRAM — La Contrainte Physique de la Souveraineté

L'inférence locale (Ollama) vit dans les contraintes matérielles. Un agent souverain doit les respecter.

### Stratégie Nexxus :
- `keep_alive: '10m'` — Maintien du modèle en GPU pour éviter les rechargements.
- Modèles classés par poids VRAM : DeepSeek-R1 (>8Go) → Qwen-7B (~5Go) → Nomic-Embed (<1Go).
- `ollama.ensureModel()` — Vérification avant chaque inférence + log de progression UI.
- `num_ctx: 4096` — Optimisé pour GPU 8Go. À augmenter pour plus de contexte si >8Go.

---

## Contraintes d'Application
- **Béton Armé** : Ce skill encode des réalités. Ne pas allonger avec des théories spéculatives.
- **Souveraineté** : Toujours préférer l'inférence locale à l'API distante.
- **Évolution** : Ce fichier doit être mis à jour à chaque évolution architecturale majeure de Nexxus.
