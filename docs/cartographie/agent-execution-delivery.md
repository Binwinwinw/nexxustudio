# Cartographie — Exécution / livraison (lot 4)

| Champ | Valeur |
|-------|--------|
| **Périmètre** | `orchestrator/SovereignOrchestrator.js`, `agents/finalRendererAgent.js`, `agents/expertWebSearch.js`, `normalizers/webEvidenceNormalizer.js`, `policies/web/webEvidenceFidelityValidator.js`, tronc COMPOSER dans `agentPipeline.js` |
| **Chemin racine** | `server/src/agent/` |
| **Date de mise à jour** | 2026-08-17 |
| **Statut** | **Lot fermé** — cadrage validé |
| **Mode** | Lecture seule — cartographie structurelle (pas de refactor) |
| **Lecture** | Inventaire, pas cible — [`METHODE.md`](./METHODE.md) |
| **Amont** | Lots 0–1 : [`agent-front-doors.md`](./agent-front-doors.md), [`agent-upstream-decision.md`](./agent-upstream-decision.md) — **non rouverts** |
| **Hors périmètre** | Lot 2 (conversation / social / epistemic) ; lot 3 (`utils/*IntentGuards`) ; canon input ; Vision / JUST / `subject_angle_explore` ; G38.2 (rail culturel) |

Document de **référence** pour tout ce qui transforme une **bonne décision amont** en **réponse visible**.  
Objectif debug : trous de rendu, fuites de packets internes, dump SERP, langue perdue.

**Règle actée :** preuve web ≠ réponse. `Résultats de recherche pour` = fuite, pas une réponse acceptable.

**Chemin acté :** amont pose le path → Sovereign accumule un packet (experts muets) → `finalRendererAgent.compose` = bouche → filets → UI.

**Debug acté :** même console Zorin ; lecture du §9 ; replay après reload pour voir le filet.

---

## 1. Articulation avec les lots 0–1

```
[lots 0–1]  entrée + décision amont
            (SC / clarify / contrat / path)
        │
        ├─ stop déterministe + reply     → visible sans ce lot
        ├─ SIMPLE_FAST / word-guard      → lot 0 `simpleFastPath` (hors détail ici)
        ├─ CHAT_LIGHT                    → packet léger → compose (bord de ce lot)
        └─ ★ pipeline plein (ce lot) ★
              SovereignOrchestrator.orchestrate
                    → packet (preuves, pas texte user)
              finalRendererAgent.compose          [télémétrie : pipelinePath=COMPOSER]
                    → texte
              filets post-compose (pipeline)
                    → _finalizePipelineTurn
```

| Question | Répondue par |
|----------|----------------|
| Qui reçoit / orchestre le tour ? | Lot 0 |
| Qui décide stop / rail / contrat ? | Lot 1 |
| Qui **exécute** experts + web après l’amont ? | **Lot 4 — Sovereign** |
| Qui **rédige** le texte user ? | **Lot 4 — COMPOSER / `finalRendererAgent`** |
| Qui peut encore livrer du brut ? | **Lot 4 — fallbacks** (§6) |

Les lots 0–1 s’arrêtent au **path**. Ce lot commence au **packet** et finit au **texte streamé**.

---

## 2. Qui prend la main après l’amont

Dans `agentPipeline.run`, si le short-circuit n’a pas stoppé et que SIMPLE_FAST / word-guard n’ont pas absorbé :

1. Console : `⚙️ Orchestrateur Souverain activé...`
2. `this._sovereign.orchestrate(query, history, opts)` — `onContent: null`  
   **Les experts ne parlent pas au client.**
3. Retour :
   - `string` → livraison directe (social / safety / fait web immédiat / recovery) ; télémétrie quand même `pipelinePath=COMPOSER`
   - `{ rawResponse, packet }` → **compose obligatoire**
4. `finalRendererAgent.compose(packet, onContent | null)`
5. Filets pipeline (clean, fidelity web, contrats domaine)
6. `_finalizePipelineTurn` — `pipelinePath=COMPOSER`

`COMPOSER` n’est pas un module. C’est le **nom de canal** du rendu `finalRendererAgent` après Sovereign.

`runPipeline.js` (lot 0, diagnostic/audit) est un **autre** runtime. Hors tour chat. Ne pas le fusionner avec ce lot.

---

## 3. Flux d’exécution jusqu’au visible

```
amont (path information_seeking_full_pipeline, DOCUMENT, …)
        │
        ▼
SovereignOrchestrator.orchestrate
        │
        ├─ classif intent runtime (matrice experts)     [re-lecture, pas lot 1]
        ├─ packet = { expert_outputs[], evidence[], meta }
        ├─ routing experts (forcedExpertKey, skipWeb)
        ├─ expert_web_search ? ──► normalisation interne ──► packet
        ├─ autres experts (document, backend, …)         ──► packet
        ├─ early return string ? ──► visible (sans compose)
        └─ execution LLM silencieuse (rawResponse dans packet)
                │
                ▼
finalRendererAgent.compose
        │
        ├─ prompt : « rédige en français » + SYNTHÈSE EXPERTE (= packet)
        ├─ LLM → texte  |  ou _fallback(packet)
        ├─ resolveVisibleWebDelivery                     [filet dump]
        └─ stream éventuel (sauf buffer DIRECT_EXPLANATION)
                │
                ▼
agentPipeline post-compose
        │
        ├─ thinking cleaner + compress
        ├─ validateWebEvidenceFidelityReply              [2e filet, après stream possible]
        ├─ validate* domaine (produit, doc, factual)
        └─ _finalizePipelineTurn → UI
```

**Point critique :** si `onContent` est passé au compose, l’UI peut voir le texte **avant** le filet pipeline §5. `DIRECT_EXPLANATION` bufferise (`mustBufferComposer`) — le filet compose + emit doit tenir **avant** le premier chunk.

---

## 4. SovereignOrchestrator — packet, pas bouche

| | |
|---|---|
| **API** | `orchestrate(query, history, opts)` |
| **Rôle** | Accumuler un `OrchestratorPacket`. Ne pas adresser l’utilisateur (sauf early-return string). |
| **Taille** | ~1600 LOC |
| **Entrées utiles lot 4** | `forcedExpertKey`, `webSearchQuery`, `intentContractId`, `onStep` (console), `onContent` forcé `null` par le pipeline |

### 4.1 Packet (objets internes)

| Champ | Nature | Visible user ? |
|-------|--------|----------------|
| `expert_outputs[].content` | Texte expert / `buildRawSummary` | **Non** — input compose |
| `expert_outputs[].stage` | ex. `web_research`, `execution` | Non |
| `evidence[]` | `{ source, excerpt, title, relevance }` | Non — citations / filet |
| `quick_answer` | Réponse courte déterministe | Seulement si compose / fallback l’élit |
| `meta.web_consulted_at` | Preuve que le web a tourné | Non |
| `meta.intent_contract_id` | Contrat d’exécution | Non |
| `rawResponse` | Sortie LLM execution | Non — compose doit réécrire |

### 4.2 Web — collecte et normalisation

| Étape | Module | Sortie |
|-------|--------|--------|
| Query web | Sovereign (`effectiveWebSearchQuery`, retry EN / topic) | String DDG, souvent **anglaise** |
| Collecte | `expertWebSearch.run` | Packet expert |
| Normalisation | `webEvidenceNormalizer` (`normalizeWebResults`, `buildRawSummary`) | Sources + **résumé brut interne** |
| Injection | Sovereign | `expert_outputs.web_research.content = summary` ; `evidence[]` ; briefing `PREUVES DE RECHERCHE WEB` |

`buildRawSummary` produit `Résultats de recherche pour : "…"`.  
**Contrat expert :** ne jamais répondre à l’utilisateur. Le résumé est pour l’orchestrateur / le prompt compose.

Query EN (`zorinos overview informations`) = **normale** pour DDG. Ce n’est pas la langue de sortie.

Skip web : contrat `skipWebSearch`, fichier local prioritaire (`🚫 Web Search désactivé`), idéation ouverte.

### 4.3 Early-return string (bypass compose)

Sovereign peut renvoyer une `string` déjà « user-facing » :

- social / safety déterministe
- fait web immédiat (`buildCurrentWebFactFactualReply`)
- recovery / refuse

Le pipeline la livre sous `pipelinePath=COMPOSER` **sans** `finalRendererAgent.compose`.  
Filet dump SERP **absent** sur ce branchement — OK tant que ces strings ne sont pas `buildRawSummary`.

---

## 5. COMPOSER / `finalRendererAgent` — synthèse finale

| | |
|---|---|
| **API** | `compose(packet, onContent)` |
| **Rôle** | Seule bouche prévue du pipeline plein : texte FR (consigne), tutoiement, contrats mode |
| **Télémétrie** | `pipelinePath=COMPOSER` |

### 5.1 Où la synthèse est produite

1. Prompt user : requête + `SYNTHÈSE EXPERTE` (= concat `expert_outputs.content`, donc souvent le dump interne).
2. Consigne : *« Rédige DIRECTEMENT la réponse finale en français. »*
3. LLM compose → `enforceComposerContract`
4. Émission : `_emitWithExplicitWebSourceLinks` → `resolveVisibleWebDelivery` puis `ensureExplicitWebSourceLinks`

La synthèse **correcte** = texte FR court + sources, **pas** le packet.

### 5.2 Buffer vs stream

| Condition | `onContent` compose | Risque |
|-----------|---------------------|--------|
| `DIRECT_EXPLANATION` ou contenu structuré | `null` (buffer) | UI après filet compose |
| Autres | callback live | UI peut afficher avant filet **pipeline** |

---

## 6. Fallbacks — où le brut peut encore sortir

| # | Lieu | Fuite | Filet actuel |
|---|------|-------|----------------|
| F1 | `expert_outputs.web_research.content` | `buildRawSummary` collé dans le prompt | Compose doit réécrire ; pas un filet |
| F2 | `finalRendererAgent._fallback` | Avant 2026-08-17 : livrait `web_research` tel quel | Désormais : dump / grounding web → `buildWebEvidenceGroundedFallback` (synthèse FR + **Sources**) |
| F3 | Compose recopie la SYNTHÈSE EXPERTE | LLM echo du dump EN | `resolveVisibleWebDelivery` à l’emit ; `validateWebEvidenceFidelityReply` (issues `raw_web_evidence_dump`, `untranslated_english_web_reply`) |
| F4 | `buildWebEvidenceGroundedFallback` **ancien** | Préfixe FR + dump brut | Réécrit : plus de recopie `output.content` |
| F5 | Filet pipeline `validateWebEvidenceFidelityReply` | Tourne **après** compose | Trop tard si stream déjà parti (hors buffer) |
| F6 | Early-return string Sovereign | Texte livré sans filet dump | Surveiller que ce n’est jamais `buildRawSummary` |
| F7 | `contextData.briefing` + raw summary | Pollue le LLM execution | Interne ; fuite si execution `rawResponse` est livré sans compose (ne devrait pas) |
| F8 | `composedResponse \|\| rawResponse` (pipeline) | Si compose vide, `rawResponse` execution peut passer au cleaner | Rare ; pas le filet dump |

**Invariant lot 4 :** `Résultats de recherche pour` / `[Source N]` + `URL:` = packet. Jamais visible.

Preuve : `server/tests/web-evidence-fidelity-validator.test.js` (dump Zorin).

---

## 7. Langue — où elle est fixée, où elle se perd

| Couche | Langue | Force ? |
|--------|--------|---------|
| Identité | `active_language: Français (Souverain)` | Déclaratif |
| Adresse | `addressingPolicy` — tutoiement | Prompt, pas validateur langue |
| Query web | FR ou EN (retry `deriveFactualResearchWebQueryEn`) | Collecte seulement |
| Snippets sources | Souvent EN (Wikipedia) | Preuve interne |
| Consigne compose | « en français » | Prompt seulement |
| Filet livraison | `looksUntranslatedEnglishWebReply` si preuves web + tour FR | Heuristique ; off si *en anglais* / *in english* |
| Filet tutoiement | `enforceComposerContract` / voice | Tu/vous, pas EN/FR |

**Perte typique (Zorin) :** query web EN + snippets EN + compose qui recopie le packet → visible EN.  
**Correct :** sources EN possibles ; **réponse FR obligatoire** si le tour n’a pas demandé l’anglais.

Pas un détecteur de langue général. Pas un parser. Filet livraison seulement.

---

## 8. Carte « packet interne → réponse visible »

```
buildRawSummary
    → expert_outputs.web_research.content     [interne]
    → briefing execution                      [interne]
    → prompt compose « SYNTHÈSE EXPERTE »     [interne, dangereux]
         ├─ LLM réécrit FR + sources          [OK]
         ├─ LLM recopie le dump               [FUITE] → resolveVisibleWebDelivery
         └─ compose vide → _fallback          [FUITE éteinte si dump détecté]
    → emit / stream                           [VISIBLE]
    → validateWebEvidenceFidelityReply        [2e filet, post]
```

`evidence[]` (url / title / excerpt) = **seule** matière licite pour citations et fallback sourcé.  
`content` web_research = **interdit** en sortie.

---

## 9. Debug live — lecture console

Tour type *« je cherche des infos sur zorinOS »* (2026-08-17) :

| Ligne | Sens |
|-------|------|
| `pipelinePath=information_seeking_full_pipeline` | Amont OK (lot 1) — **pas** le trou |
| `Orchestrateur Souverain activé` | Lot 4 commence |
| `Contrat : DIRECT_EXPLANATION` | Compose bufferisé |
| `Expert forced [Expert Web Search]` | Collecte |
| `Preuves … injectées (3 sources)` | Normalisation OK — packet interne |
| `Composition de la réponse finale` | `finalRendererAgent.compose` |
| `pipelinePath=COMPOSER` | Canal rendu |
| Texte `Résultats de recherche pour` | **Fuite F3/F2** — packet devenu visible |

Après filet 2026-08-17 : même console amont/web ; texte attendu = synthèse FR + **Sources**, plus le dump.

Replay : reload → même query → pas de `Résultats de recherche pour` dans l’UI.

---

## 10. Inventaire fichiers (lot 4)

| Fichier | Rôle |
|---------|------|
| `orchestrator/SovereignOrchestrator.js` | Exécution experts, web, packet |
| `agents/expertWebSearch.js` | Collecte ; contrat « pas de bouche » |
| `normalizers/webEvidenceNormalizer.js` | `buildRawSummary` **interne** |
| `agents/finalRendererAgent.js` | Compose + `_fallback` + emit |
| `policies/web/webEvidenceFidelityValidator.js` | Dump / EN / fallback sourcé |
| `agentPipeline.js` (tronc ~2988–3350) | Appel Sovereign → compose → filets → finalize |
| `config/modeResponseContracts.js` | Enforcement mode (pas langue) |
| `policies/posture/addressingPolicy.js` | Tutoiement |

---

## 11. Risques

| ID | Risque | Gravité | Signal |
|----|--------|---------|--------|
| E1 | Prompt compose = dump brut | Haute | Echo EN / `Résultats de recherche pour` |
| E2 | Filet pipeline après stream | Haute | UI dump puis rien |
| E3 | Early-return string hors filet | Moyenne | `typeof orchestrationResult === "string"` |
| E4 | `rawResponse` si compose vide | Moyenne | `composedResponse \|\| rawResponse` |
| E5 | Langue = prompt only | Moyenne | Filet heuristique, pas contrat |
| E6 | Sovereign re-classifie l’intent | Hors lot (bord 1) | Matrice experts ≠ path amont |

---

## 12. Pistes (non implémentées — hors ce lot doc)

1. Ne plus injecter `buildRawSummary` comme `expert_outputs.content` — garder `evidence[]` structuré pour le prompt.  
2. Passer le filet dump **avant** tout `onContent`.  
3. Early-return string : même `resolveVisibleWebDelivery`.  
4. Ne pas ouvrir lots 2–3 depuis cette vue.

---

## 13. Vérifs

| Vérif | Geste | Attendu |
|-------|--------|---------|
| Entrée Sovereign | Grep `_sovereign.orchestrate` | `agentPipeline` seulement |
| Compose | Grep `finalRendererAgent.compose` | Tronc pipeline plein |
| Dump | Grep `Résultats de recherche pour` | Normalizer + tests ; **pas** UI |
| Filet | `web-evidence-fidelity-validator.test.js` | Vert |
| Replay Zorin | Après reload | FR + Sources ; pas de dump |

---

## 14. Critère de fermeture

- Chemin exécution → rendu décrit.
- Fallbacks / fuites nommés (F1–F8).
- Preuve web ≠ réponse finale (règle + filet).
- Console live lisible avec cette vue.

**Lot 4 fermé proprement.** Vue utile au debug live. Six points couverts. Lots 0–1, 2, 3, canon, Vision, JUST, `subject_angle_explore` : non rouverts.

**Plateforme :** lots 0–4 écrits. Policies domaine : [`agent-domain-policies.md`](./agent-domain-policies.md) — hors cette topologie.

---

## 15. Journal

| Date | Changement |
|------|------------|
| 2026-08-17 | Création lot 4 — vue exécution / livraison |
| 2026-08-17 | Cadrage validé : chemin, 6 points, règle preuve ≠ réponse, mode opératoire Zorin §9 |
| 2026-08-17 | Verdict plateforme : colonne complète ; lots 2–3 et policies domaine manquent |
| 2026-08-17 | Pointeur : policies domaine écrite — [`agent-domain-policies.md`](./agent-domain-policies.md) |
| 2026-08-18 | Lecture : inventaire pour décider — [`METHODE.md`](./METHODE.md) |
