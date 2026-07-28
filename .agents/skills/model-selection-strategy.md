# Skill: Model Selection Strategy (Stratégie de Sélection des Modèles)

## Purpose
Guider Nexxus dans le choix du modèle optimal selon la tâche, la contrainte VRAM,
et les capacités disponibles dans l'écosystème Ollama local.

---

## 1. La Règle d'Or : Proportionnalité

> Le modèle le plus puissant n'est PAS toujours le bon choix.
> Le bon modèle est celui qui résout la tâche avec le minimum de VRAM et de latence.

---

## 2. Carte des Modèles Nexxus

| Modèle               | VRAM approx. | Forces                                      | Cas d'usage Nexxus                          |
|----------------------|-------------|---------------------------------------------|---------------------------------------------|
| `deepseek-r1:14b`    | ~9 Go       | Raisonnement étendu (`<think>`), causalité  | Expert Elite, décisions architecturales      |
| `ornith:9b`          | ~8 Go       | Chat rapide, synthèse légère, orchestrateur  | Tour de contrôle, social bypass, code light  |
| `nomic-embed-text`   | <1 Go       | Vecteurs d'embeddings haute qualité         | Routage sémantique (ne pas utiliser pour chat)|
| `qwen2.5-coder:7b`   | ~4.7 Go     | Code expert Forge, bon ratio 8 Go VRAM       | BUILDER, ELITE_CODER, Engineering            |
| `llama:8b-elite`      | ~6.6 Go     | Audit, critique, analyse de code            | expert_auditeur (validation Éveil)           |
| `nexxus-vox:latest`   | ~531 Mo     | Retranscription souveraine dédiée           | VOX_MODEL — toujours disponible en VRAM     |

---

## 3. Matrice de Décision

```
TÂCHE ?
  ├─ Salutation / Social             → ornith:9b (Social Bypass, < 2s)
  ├─ Retranscription / Voix          → nexxus-vox:latest (VOX_MODEL, T=0.3)
  ├─ Code léger / Question factuelle → ornith:9b
  ├─ Architecture / Raisonnement     → deepseek-r1:14b (avec <think>)
  ├─ Audit / Validation              → llama:8b-elite (expert_auditeur)
  ├─ Embedding / Recherche           → nomic-embed-text (jamais pour chat)
  └─ Brainstorming / Discussion:     → deepseek-r1:14b (via expert_analyst Elite)
```

---

## 4. Gestion VRAM — Règles Opérationnelles

### Séquençage obligatoire
```
1. ollama.ensureModel(bestModel)     ← Vérifie + log la progression
2. Inférence principale (bestModel)
3. Si audit → ollama.ensureModel(auditorModel) avec keep_alive: '10m'
4. Si VOX   → nexxus-vox:latest (déjà chargé, < 1Go)
```

### keep_alive stratégique
- `keep_alive: '10m'` → Modèles de raisonnement (coûteux à recharger).
- `keep_alive: '5m'`  → Modèles de code (plus légers, rechargement rapide).
- `keep_alive: 0`     → Libérer immédiatement après un embedding (nomic).

### Limites num_ctx par modèle
| Modèle             | num_ctx recommandé | Notes                              |
|--------------------|-------------------|------------------------------------|
| deepseek-r1:14b    | 4096              | Au-delà → risque OOM sur 8 Go GPU  |
| ornith:9b          | 8192              | Peut monter si GPU > 10 Go          |
| qwen2.5-coder:7b   | 8192              | Tier 3 lazy — ~4.7 Go VRAM                  |
| llama:8b-elite     | 4096              | Audit et analyse de code               |
| nexxus-vox:latest  | 2048              | Retranscription uniquement (léger)      |

---

## 5. Le Dual-Model Pattern — Architecture Recommandée

```
[1. PENSEUR] deepseek-r1:14b
   → Raisonnement profond, <think> visible dans Terminal
   → Génère une réponse technique et dense

[2. VOIX] ornith:9b (ou nexxus-vox:latest)
   → Reçoit : "Penseur a dit : {réponse_penseur}"
   → Produit : Communication naturelle, souveraine, en français
   → Temperature: 0.3 (précision > créativité)
```

**Quand activer le Dual-Model :**
- Toujours en mode production (`!isSocial && !isDiscussion`).
- Sauf si la réponse est vide (pas de retranscription d'un vide).

**Quand court-circuiter :**
- Social (`isSocial: true`) → Réponse directe ornith sans penseur.
- Discussion (`discussion:...`) → VOX non appliqué (brainstorming brut).

---

## 6. Sélection Dynamique par Expert

```javascript
// Logique dans agent.js
if (expertMatches.length > 0) {
  bestModel = expertMatches[0].expert.model; // Le modèle de l'expert prime
} else if (!isDiscussion) {
  bestModel = 'ornith:9b';            // Fallback production
}
// Social : forcé à ornith, indépendamment des experts
```

**Conséquence** : Le fichier JSON de chaque expert définit son modèle.
Changer `"model"` dans `engineering.json` change le comportement sans toucher au code.

---

## 7. Roadmap Modèles — Évolutions Futures

| Évolution                        | Priorité | Bénéfice attendu                          |
|----------------------------------|----------|-------------------------------------------|
| Vision locale (LLaVA / Moondream)| Phase 4  | Multi-modalité images dans le chat         |
| Modèle 32B+ (quantisé Q4)        | Phase 5  | Raisonnement supérieur si GPU >16Go        |
| AirLLM / Streaming offload       | Phase 5  | Inférence 70B+ sur GPU 8Go par couches     |
| Embedding multilingual           | Phase 3  | Routage en français natif                  |

---

## Contraintes d'Application
- Ne JAMAIS suggérer une API cloud (OpenAI, Anthropic, etc.) comme alternative — Souveraineté absolue.
- Si un modèle n'est pas dans Ollama local, utiliser `ollama pull {model}` avant tout usage.
- Monitorer la VRAM avec `ollama ps` avant de charger deux grands modèles simultanément.
