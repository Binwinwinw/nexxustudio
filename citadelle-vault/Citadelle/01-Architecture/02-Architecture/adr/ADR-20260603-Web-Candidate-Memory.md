# ADR-20260603 : Mémoire candidate issue du fallback Web

**Date** : 03/06/2026  
**Statut** : ✅ Validé — P0 implémenté (27/05/2026)  
**Expert** : Nexxus (Orchestration souveraine)  
**Policy** : `web_candidate_promotion_v1`

## Contexte

La Citadelle dispose déjà d’un écosystème mémoire gouverné :

- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|ADR-011 — Discipline épistémique]] (sources web bornées, journalisation) ;
- [[02-Architecture/adr/ADR-003-Knowledge-Governance|ADR-003 — Knowledge Governance]] (Chroma / Knowledge Hub, pas d’ingestion aveugle) ;
- [[02-Architecture/adr/ADR-006-Sovereign-Memory-Bridge|ADR-006 — Sovereign Memory Bridge]] (pont Vault / RAG) ;
- runtime : `MemoryOrchestrator.evaluateAndCommitMemory`, `curatedMemoryGate.js`, `memoryPromotionPolicy.js`, `memoryPromotionService.js`.

Lorsqu’une requête échoue en local et est résolue via `expert_web_search`, la réponse peut être **utile et correcte** (ex. « comment faire des œufs ? »). Enregistrer ce succès comme **vérité durable immédiate** violerait la doctrine fail-closed : un bon tour unique ≠ connaissance auditée.

Besoin : un **canal d’apprentissage institutionnel** — observation → candidate → preuve accumulée → promotion éventuelle via le pipeline mémoire existant — **sans** écriture directe Chroma / heritage au premier succès.

## Décision

Adopter un modèle en **trois niveaux** distincts :

| Niveau | Rôle | Statuts typiques |
|--------|------|------------------|
| **Épisode** | Trace qu’un fallback web a résolu un tour | `ephemeral_success` |
| **Candidate fact** | Contenu potentiellement réutilisable, sourcé, scoré | `candidate_saved` |
| **Connaissance promue** | Entrée durable via pipeline curated existant | `promoted_to_local_knowledge` / `promotion_rejected` |

**Formule opérationnelle** :

```text
succès web utile → épisode → candidate fact → validation + replays → promotion éventuelle
```

### Principes non négociables

1. **La chaîne décisionnelle gouverne** — le LLM rédige ; il ne promeut pas.
2. **Fail-closed** — en cas de doute : rester en `candidate_saved` ou `promotion_rejected`.
3. **Local-first P0** — JSONL sous `server/data/memory/web-candidates/` ; **pas** d’écriture Chroma / Knowledge Hub au premier succès.
4. **Réutilisation du pipeline existant** — promotion finale via `evaluateAndCommitMemory` + `memoryPromotionPolicy` (tiers episodic / semantic), pas un silo parallèle « vérité web ».

## Architecture P0 (modules)

| Module | Responsabilité |
|--------|----------------|
| `webFallbackMemoryRecorder.js` | Post-résolution : journal épisode + création candidate si seuils minimaux |
| `candidateKnowledgeStore.js` | CRUD local-first (append, findByQuery, replays, validation) |
| `knowledgePromotionPolicy.js` (web) | Critères explicites avant appel au pipeline curated |

### Point d’insertion pipeline

1. **Après** synthèse réussie dont `resolution_path === web_fallback` (orchestrateur ou fin de tour `/api/chat`).
2. **Après** feedback utilisateur (`/api/sessions/:id/feedback`) pour lier `validated_by_user` / `implicitly_accepted`.
3. **Avant** réutilisation : lookup candidate (P1) pour court-circuit grounded local — **hors scope P0**.

## Schéma — Candidate fact (v1)

```json
{
  "id": "ckf_<iso>_<hash>",
  "status": "candidate_fact",
  "query_raw": "comment on fait des œufs ?",
  "query_normalized": "comment faire cuire des oeufs",
  "answer_synthesized": "…",
  "domain": "cuisine_basique",
  "case_type": "how_to",
  "sources": [
    {
      "url": "https://…",
      "title": "…",
      "snippet": "…",
      "trust_tier": "web_filtered"
    }
  ],
  "web": {
    "expert": "expert_web_search",
    "confidence": 0.82,
    "source_consensus_score": 0.74,
    "failure_mode": null,
    "elapsed_ms": 1240
  },
  "validation": {
    "validated_by_user": false,
    "implicitly_accepted": true,
    "feedback_rating": null,
    "user_corrected": false,
    "reuse_count": 0,
    "coherent_replays": 0
  },
  "provenance": {
    "session_id": "…",
    "turn_id": "…",
    "pipeline_mode": "SIMPLE_FAST",
    "resolution_path": "web_fallback"
  },
  "promotion": {
    "eligible": false,
    "reasons": ["awaiting_coherent_replays"],
    "policy_version": "web_candidate_promotion_v1"
  },
  "created_at": "2026-06-03T12:00:00Z"
}
```

### Champs raffinés (vs brouillon initial)

- **`source_consensus_score`** (0–1) : distingue « 2 URLs différentes mais faibles » de « sources compatibles et propres » (similarité snippet, même claim, politique URL OK). Calculé à l’enregistrement, pas au promote.
- **`validated_by_user`** vs **`implicitly_accepted`** :
  - `validated_by_user: true` → feedback explicite (`useful`, etc.) ;
  - `implicitly_accepted: true` → absence de correction **sans** équivalence à une validation forte — poids moindre en policy.
- **`domain`** — taxonomie **volontairement simple** en P0 :
  - `cuisine_basique`
  - `fait_historique`
  - `definition_generale`
  - `autre` (filet de sécurité ; pas de micro-taxonomie prématurée)

## Politique de promotion — `web_candidate_promotion_v1`

Promotion vers `evaluateAndCommitMemory` **uniquement si** :

| Critère | Seuil / règle |
|---------|----------------|
| Sources | ≥ 2 URLs distinctes, politique URL conforme ADR-011 |
| Confiance web | `web.confidence` ≥ 0.65 |
| Consensus sources | `source_consensus_score` ≥ 0.55 |
| Correction | `user_corrected === false` |
| Validation | `validated_by_user === true` **OU** (`implicitly_accepted` + `coherent_replays` ≥ 2) |
| Cohérence | même `query_normalized` revu **2–3 fois** avec réponses compatibles |
| Pipeline mode | pas en `ephemeralModes` seuls si cible semantic (réutiliser `memoryPromotionPolicy`) |

**Sorties** :

- `candidate_saved` — inchangé, en attente ;
- `promotion_rejected` — reasons[] traçables ;
- `promoted_to_local_knowledge` — après succès `executeMemoryPromotion`.

**Interdit en P0** : promotion automatique après un seul succès sans validation explicite ni replays cohérents.

## Différenciation des mémoires

| Type | Contenu | Réutilisation |
|------|---------|---------------|
| Conversationnelle | Historique session / snapshots UI | Contexte de tour |
| Épisode web | Audit « ce tour a utilisé le fallback » | Stats, promotion, debug |
| Candidate / promue | Fait ou procédure monde réel | Briefing local, moins de web (P1+) |

## Télémétrie & tests

- Spans / logs : `nexxus.web_memory.episode`, `nexxus.web_memory.candidate`, `nexxus.web_memory.promotion`.
- Tests P0 : `server/tests/web-candidate-promotion.test.js` (policy pure + store append/find).
- Quality gate : enregistrer le test dans la liste quality-gate lors de l’implémentation.

## P0 vs P1

| P0 (après cet ADR) | P1 |
|--------------------|-----|
| ADR + modules recorder / store / policy web | Lookup candidate avant `webSearch` |
| Hook post-chat + binding feedback | Fiches domaine agrégées |
| JSONL local, pas Chroma | ADR lien Knowledge Hub navigable |
| | `source_consensus_score` affiné (NLP léger) |

## Conséquences

- **Positif** : apprentissage traçable ; moins de recherches web répétitives à terme ; cohérence avec guardianship mémoire existant.
- **Coût** : stockage JSONL à purger / réviser ; discipline de maintenance (review_at) à prévoir en P1.
- **Risque évité** : « mémoire magique » — une bonne réponse ponctuelle ne devient pas ADR implicite.

## Ordre d’implémentation recommandé

1. ✅ Cet ADR (doctrine figée).  
2. ✅ P0 code : `server/src/agent/memory/web-candidates/` (`webFallbackMemoryRecorder`, `candidateKnowledgeStore`, `webCandidatePromotionPolicy`).  
3. ✅ Hook post-`/api/chat` + feedback `validated_by_user` (`WEB_CANDIDATE_MEMORY=1`).  
4. ✅ Tests `server/tests/web-candidate-promotion.test.js` (quality-gate).

---

### Liens de parenté

- [[02-Architecture/adr/ADR-001-Web-Consciousness|ADR-001 — Web Consciousness]]
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|ADR-011 — Discipline épistémique]]
- [[02-Architecture/adr/ADR-003-Knowledge-Governance|ADR-003 — Knowledge Governance]]
- [[02-Architecture/adr/ADR-006-Sovereign-Memory-Bridge|ADR-006 — Sovereign Memory Bridge]]
- `server/src/agent/memory/guardianship/` — pipeline curated existant
- [[Wiki/Wiki-ADRs-Index|Atlas des ADRs]]
