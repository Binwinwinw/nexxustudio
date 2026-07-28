# Skill: Memory Systems & Knowledge Architecture

## Purpose
Comprendre et opérer les différents systèmes de mémoire disponibles dans Nexxus Studio
pour maximiser la pertinence contextuelle sans dépasser les limites matérielles.

---

## 1. La Pyramide de Mémoire

```
       ┌──────────────────┐
       │   MÉMOIRE FROIDE  │  ← Skills .md / Docs / Chartre
       │  (Savoir ancré)   │     Durée : Permanente (fichiers)
       ├──────────────────┤
       │  MÉMOIRE TIÈDE   │  ← Sessions JSON + Cache Embeddings
       │  (Vécu du projet) │     Durée : Persistée sur disque
       ├──────────────────┤
       │  MÉMOIRE CHAUDE  │  ← currentHistory[] en RAM
       │  (Conversation)   │     Durée : Vie de la session active
       └──────────────────┘
            ↑
     Context Window du LLM
       (num_ctx: 4096 tokens)
```

---

## 2. Mémoire Froide — Le Savoir Souverain

### Localisation
```
.agents/skills/          ← Bibliothèque de savoirs procéduraux
docs/ROADMAP.md          ← Vision et jalons stratégiques
docs/chartre.md          ← ADN et principes fondateurs (à créer)
```

### Règles d'utilisation
- Lire ces fichiers **avant** toute décision architecturale.
- Les mettre à jour après chaque évolution majeure (principe Béton Armé).
- Le system prompt de l'agent doit référencer ces fichiers pour que l'expert sache les consulter.

---

## 3. Mémoire Tiède — La Continuité du Projet

### SessionStore (`server/src/services/sessionStore.js`)
```
server/data/sessions/
  └── {session-id}.json  ← { id, title, timestamp, messages[] }
```

**CRUD disponible :**
- `listSessions()` — Toutes les sessions triées par date décroissante
- `getSession(id)` — Session complète avec historique
- `saveSession(id, data)` — Sauvegarde/mise à jour
- `deleteSession(id)` — Suppression propre

### Cache Vectoriel (`server/data/experts_cache.json`)
- 288 Ko de vecteurs pré-calculés pour tous les experts.
- Invalider le cache si un expert JSON est modifié : supprimer `experts_cache.json` pour forcer la ré-indexation.
- Format : `{ "Division:expert_key": { vector: [...], expert: {...} } }`

---

## 4. Mémoire Chaude — La Conscience de la Conversation

### Structure en RAM (agent.js)
```javascript
let currentHistory = [...history]; // Messages injectés depuis la session
// Format OpenAI-compatible :
// { role: 'user' | 'assistant' | 'system', content: string }
```

### Injection stratégique dans la boucle
```javascript
// Après une action (webSearch, librarianSearch, audit) :
currentHistory.push({ role: 'assistant', content: fullResponse });
currentHistory.push({ role: 'user', content: `RÉSULTATS: ${results}` });
// → Le LLM voit le résultat au prochain tour d'itération
```

### Limite et stratégie
- `num_ctx: 4096` = environ 3000 mots effectifs.
- Si l'historique est long : injecter un **résumé** plutôt que l'historique brut.
- Futur : Implémentation d'un `summarizer` automatique pour les sessions > N tokens.

---

## 5. Le Index Sémantique — La Mémoire des Experts

### Construction (expertRouter.js — `init()`)
```
Pour chaque expert JSON :
  1. Vérifier le cache vectoriel
  2. Si absent → ollama.getEmbedding(name + description + when_to_use)
  3. Stocker dans this.index[fullKey] et this.index[shortKey]
  4. Construire l'index BM25 avec pondération :
     - name × 3 (le plus discriminant)
     - when_to_use × 2 (cas d'usage = haute pertinence)
     - description × 1
     - scope × 1
```

### Interrogation
```
Query → getEmbedding(query) → Cosine avec tous les vecteurs (seuil: 0.55)
      → tokenize(query)     → Score BM25 pour chaque expert
      → RRF Fusion (k=60)   → Top-5 candidats → Master Orchestrator
```

---

## 6. Roadmap Mémoire — Ce qui reste à construire (Phase 3)

| Fonctionnalité                  | Statut       | Impact                                   |
|---------------------------------|--------------|------------------------------------------|
| Mémoire persistante par projet  | ❌ À faire   | Nexxus se souvient des projets passés     |
| RAG sur documents personnels    | ❌ À faire   | Indexation de PDF/Markdown utilisateur    |
| Summarizer automatique session  | ❌ À faire   | Gestion des longues conversations         |
| Mémoire épisodique (timeline)   | ❌ À faire   | "Je me souviens qu'on avait décidé..."   |

---

## Contraintes d'Application
- Ne jamais stocker de données sensibles en clair dans les fichiers de session.
- La mémoire froide (skills) prime toujours sur les intuitions du modèle en cas de conflit.
- Un vecteur périmé vaut mieux qu'aucun vecteur — ne purger le cache qu'en cas de modification significative d'un expert.
