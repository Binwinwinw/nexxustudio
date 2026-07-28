# ADR-20260601 : Mémoire de fil (M2)

## Statut
**En cours** (01/06/2026) — chantier ouvert post-M1

## Contexte

La roadmap « Prouver avant d'ouvrir » place le **mois 2** sur la mémoire conversationnelle de session, distincte du patrimoine curé (ChromaDB, M4).

M1 a livré traces + bootstrap. Le fil de conversation doit devenir **fiable, prouvable et non hallucinant** avant d'enrichir Forge (M3) ou le patrimoine (M4).

### Distinction non négociable

| Type | Périmètre | Stockage | Pipeline |
|------|-----------|----------|----------|
| **Mémoire de fil** | Session courante | `session_events` (MySQL) | Rappel, contexte `/api/stream`, synthèse Tier 2 |
| **Patrimoine curé** | Long terme multi-session | ChromaDB + gate promotion | RAG, faits validés — **hors M2** |

Ne pas fusionner les deux pipelines avant M4.

---

## État des lieux (01/06/2026)

| Brique | État | Fichier |
|--------|------|---------|
| Persistance user/assistant | ✅ | `runtimeService.js` + `/api/stream` |
| Historique DB prioritaire (40 tours) | ✅ | `sessionHistoryService.js` |
| Rappel Tier 1 (template) | ✅ | `conversationGuards.js` |
| Rappel Tier 2 (LLM léger) | ✅ partiel | `conversationRecallSynthesizer.js` |
| Contrat « n'invente pas » | 🔄 en cours | `recallGroundingValidator.js` (M2-S1) |
| Tests régression sans LLM live | 🔄 en cours | premerge étendu |
| Interface `InferenceProvider` | 🔄 en cours | spec [[ADR-20260530-API-v1-InferenceProvider]] |
| Distinction fil vs patrimoine dans le code | ⏳ | documentation + guards |

---

## Décision

Renforcer la **mémoire de fil** en trois axes :

### 1. Source de vérité session

- **DB `session_events`** prioritaire sur l'historique client pour `agent.run`
- Limite par défaut : **40 tours** (`DEFAULT_LIMIT`)
- Fallback client uniquement si DB vide ou erreur transactionnelle
- Événements : `user_message`, `ai_response`, famille `CONVERSATION`

### 2. Rappel conversationnel à deux tiers

| Tier | Mécanisme | Quand |
|------|-----------|-------|
| **Tier 1** | Template déterministe (`buildConversationRecallResponse`) | Historique pauvre (< 2 entrées utiles) ou échec Tier 2 |
| **Tier 2** | LLM léger (`AGENT_ROLES.CHAT`) + prompt strict | Historique suffisant |

**Contrat épistémique Tier 2** :

- Ne citer **que** le transcript transmis
- **Interdit** d'inventer des marqueurs temporels (`hier`, `la semaine dernière`, …) absents de l'historique
- Footer adapté : « fil uniquement » vs « hier » selon la requête (`buildRecallFooter`)
- Post-validation **`validateRecallGrounding`** → fallback Tier 1 si violation
- Pas de refus épistémique canonique en mode rappel (sauf signal truly empty)

### 3. InferenceProvider (spec M2, impl default)

Interface formelle pour découpler Ollama du pipeline rappel et des futurs providers (M5–6) :

- `ollamaProvider` = implémentation default
- Tests mock sans réseau
- **Pas** de migration massive du pipeline en M2 — seulement rappel + registre

---

## Non-objectifs M2

- Promotion mémoire vers Chroma (M4)
- RAG cross-session sur le fil brut
- Consolidation LTM automatique depuis rappel
- `/api/v1` HTTP (M5)
- Multi-expert parallèle sur le rappel

---

## Plan d'implémentation M2

| Sprint | Livrable | Critère done |
|--------|----------|--------------|
| **M2-S1** | `recallGroundingValidator` + tests + branchement synthesizer | 0 violation temporelle sur golden recall mock |
| **M2-S2** | `InferenceProvider` + `ollamaProvider` + tests mock | premerge PASS ; rappel injectable via mock |
| **M2-S3** | Bundle régression `memory-thread-regression.test.js` | session DB + recall + grounding en un fichier premerge |
| **M2-S4** | Doc opérateur + checklist fil vs patrimoine | Section vault 04-Operations/procedures |

---

## Matrice d'échecs mémoire fil

| Symptôme | Cause probable | Comportement attendu |
|----------|----------------|----------------------|
| « Rien dans le fil » alors qu'il y a eu des échanges | Client seul, DB non persistée | Vérifier `runtimeService.record*` ; historique DB |
| Rappel mentionne « hier » sans source | Hallucination Tier 2 | `validateRecallGrounding` → fallback Tier 1 |
| Refus épistémique en rappel | LLM hors contrat | Fallback template |
| Historique tronqué à 40 | Limite voulue | Documenter ; pas de bug |
| Rappel cite patrimoine Chroma | Confusion pipeline | **Bug** — fil uniquement en M2 |

---

## Critères de succès M2 (roadmap)

- [x] Historique DB prioritaire sur client (40 tours) — **fait**
- [ ] Rappel Tier 2 avec contrat « n'invente pas » **prouvé par tests**
- [ ] `InferenceProvider` interface + mock tests en premerge
- [ ] Bundle régression mémoire fil sans LLM live

---

## Liens

- [[ADR-20260530-Traces-MVP-Correlées|Traces MVP]]
- [[ADR-20260530-API-v1-InferenceProvider|InferenceProvider spec]]
- [[ADR-20260601-Bootstrap-Readiness-Sondes|Bootstrap M1-S2]]
- [[Roadmap-6-Mois-Prouver-Avant-Ouvrir|Roadmap 6 mois]]
- [[ADR-006-Sovereign-Memory-Bridge|Pont mémoire souveraine]] — patrimoine, pas fil
