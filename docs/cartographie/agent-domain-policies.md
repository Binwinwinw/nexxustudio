# Cartographie — Policies domaine (vue séparée)

| Champ | Valeur |
|-------|--------|
| **Nature** | Vue **métier**, pas une 6e topologie |
| **Registre** | [`docs/agents/nexxus-routing-behavior-registry-v1.md`](../agents/nexxus-routing-behavior-registry-v1.md) — packs G31+ (catalogue, pas recopié) |
| **Specs** | [`summary-contract-g38-spec.md`](../agents/summary-contract-g38-spec.md) (G38 / G38.2) ; autres specs packs dans `docs/agents/` |
| **Date** | 2026-08-17 |
| **Statut** | **Fermé** (lien familles ↔ système) |
| **Lecture** | Inventaire, pas cible — [`METHODE.md`](./METHODE.md) |
| **Interdit** | Fusion avec lots 0–4 ; 3e doc amont ; parser ; rework lots fermés ; recopier le registre |

Topologie (entrée, amont, livraison, compréhension, guards) = **autre carte**. Ici : **quelle règle métier s’enclenche**, **où elle s’arrête**, **sur quelle couche elle s’accroche**.

---

## 1. Règle de lecture

| Cette vue | Le registre |
|-----------|-------------|
| Famille, déclencheur, périmètre, accroche lots 0–4 | Pack Gxx, path, contrat, télémétrie, tests |

Un pack G38.2 **n’est pas** un lot de cartographie. C’est une **policy** accrochée au SC (lot 1) et au compose (lot 4).

Familles **déjà** dans la topologie — ne pas les redécrire :

| Famille | Où |
|---------|-----|
| Conversation / social / epistemic | Lot 2 |
| Routing / intent / clarify / SC | Lot 1 |
| Web preuve / dump / compose | Lot 4 |
| Guards `isXRequest` | Lot 3 |

---

## 2. Accroche aux lots (sans fusion)

```
[lot 2] comprendre     : parfois classifie le domaine (summary contract, PJ)
[lot 3] guards         : booléens « est-ce du code / how-to / info… »
[lot 1] SC / contrats  : path + forcedIntentContractId
[lot 0] SIMPLE_FAST    : enforcement flags domaine
[lot 4] Sovereign + COMPOSER + validators post-compose
```

Policy domaine = **règle de régime** une fois le path posé (ou pour poser un path métier). Pas un 2e amont.

---

## 3. Famille code

| | |
|---|---|
| **Dossier** | `policies/code/` |
| **Packs registre** | G40–G40.4, CODE_* |
| **Déclencheur** | Guard / justIntent `code_*` ; shell explain concept, review, create, projet léger ; snippet collé |
| **Périmètre** | Livraison code, review, glossaire concept, projet light — **pas** résumé d’œuvre, **pas** PJ document |
| **Bloque** | `document_synthesis`, create HTML si « c’est quoi un tag », COMPOSER si lock G40.2 |
| **Laisse** | SIMPLE_FAST `technical_overview` / glossary ; full si create lourd |

**Relation**

- Lot 3 : `debugDiagnostic*`, `repoAnalysis*`, `reactAudit*`
- Lot 1 : rails SC code / how-to
- Lot 0 : `simpleFastPath` enforcements code
- Lot 4 : `codeDeliveryRuntimeGuard` sur le texte ; skip web si fichier local (`DOCUMENT_ATTACHED`)

---

## 4. Famille document

| | |
|---|---|
| **Dossier** | `policies/document/` |
| **Packs** | G32 `GUIDED_DOCUMENT_SYNTHESIS` ; analyse / synthèse / PDF |
| **Déclencheur** | Shell « résume ce texte / PJ / chapitre » **avec source** ; analyse document ; PDF texte vs OCR |
| **Périmètre** | Compression **fidèle** à une source fournie — pas known_entity (G38) |
| **Bloque** | Résumé Interstellar sans PJ (c’est summary) ; hallucination hors source |
| **Laisse** | `document_synthesis_*` ; validator post-compose (lot 4) |

**Relation**

- Lot 2 : `understandQuery` domaines document
- Lot 1 : `document_synthesis_clarify` si source manquante
- Lot 4 : ingestion + `validateDocumentSynthesisReply`

---

## 5. Famille summary / G38+

| | |
|---|---|
| **Dossier** | `policies/summary/` |
| **Packs** | G37, G38, **G38.2** |
| **Déclencheur** | Shell résumé + œuvre identifiée **sans** ancre document ; ou contrat `summary/*` |
| **Périmètre** | `DIRECT_SUMMARY` / `TEXT_SUMMARY` / `WEB_SUMMARY` — router G38 ; lock exécution G38.2 |
| **Bloque** | Demande de PJ sur film connu ; dump encyclopédique ; refus local « pas de synopsis » comme réponse |
| **Laisse** | Synopsis local factuel ; **web obligatoire** si miss local (œuvre identifiée seulement — pas web systématique) |

**Relation**

- Lot 2 : `classifySummaryContract` juste après understand (classif, pas path)
- Lot 1 : SC `cultural_content_summary`
- Lot 4 : path `_web` = Sovereign web + compose ; **preuve ≠ réponse** (lot 4) reste au-dessus
- Spec : addendum G38.2 — ne pas recopier ici

---

## 6. Famille attachment

| | |
|---|---|
| **Dossier** | `policies/attachment/` |
| **Packs** | `ATTACHMENT_READ_MANDATE_V1` |
| **Déclencheur** | PJ réelle + tâche sur le fichier (lire, expliquer, extraire) |
| **Périmètre** | Mandat de **lire** l’attachement documentaire ; framing `code_review` / `document`. Raster seul → Vision (`VISION_ATTACHED`), mandat inactif (canon invariant 10). |
| **Bloque** | Réponse « je n’ai pas le fichier » si la PJ est là ; traiter une PJ comme une query nue |
| **Laisse** | Ingestion lot 4 ; analyse locale prioritaire (web skip si contrat fichier) |

**Relation**

- Lot 0 : `agentPipeline` attachments tôt
- Lot 2 : `turnComprehension` / understand voient `attachments`
- Lot 1 : `shouldRouteAttachmentTaskToFullPipeline`
- Lot 4 : `DOCUMENT_ATTACHED`, critic `file_not_used` (tour CSS — trou livraison/contrat, pas amont)

---

## 7. Famille memory

| | |
|---|---|
| **Dossier** | `memory/` (hors `policies/` — même vue métier) |
| **Déclencheur** | Tour avec session ; web injecté (`stashWebTurnSnapshot`) ; promotion candidats ; recall explicite |
| **Périmètre** | Session work, guardianship (write/critic/promote), web-candidates — **pas** NLU, **pas** path |
| **Bloque** | Écriture non gouvernée ; recall qui court-circuite un rail (SC early memory → `null` vers full) |
| **Laisse** | Contexte session pour understand (lot 2) et Sovereign (lot 4) |

**Relation**

- Lot 0 : session work en tête de `run`
- Lot 2 : history / continuité
- Lot 1 : some SC `memory recall → null`
- Lot 4 : snapshot web après preuves

Memory **n’est pas** un pack G38. Lien registre : aucun Gxx dédié obligatoire — rester hors fusion SC.

---

## 8. Famille delivery (bord code / compose)

| | |
|---|---|
| **Dossier** | `policies/delivery/` |
| **Déclencheur** | Promesse de livrable, HTML workshop, lettre, prompt-for-artifact |
| **Périmètre** | Forme du **livrable** une fois le path posé |
| **Relation** | Lot 0 SIMPLE_FAST + lot 4 compose / `_deliverWithCodeReviewGuard` |

Pas un 2e router. Accroche **bouche**.

---

## 9. Debug : quelle famille ?

| Symptôme | Famille | Pas |
|----------|---------|-----|
| Résumé film → dump ou refus local | summary G38.2 + lot 4 dump | Guards lot 3 seuls |
| PJ CSS → tutorial générique / `file_not_used` | attachment + document + lot 4 critic | Lot 1 path si déjà DOCUMENT |
| « c’est quoi un div » → create HTML | code G40.1 | Summary |
| « résume ce PDF » sans PJ | document clarify | G38 known_entity |
| Fait web EN visible | lot 4 (preuve ≠ réponse) | G38 |

Pack exact, tests, télémétrie : **registre**.

---

## 10. Fermeture

Vue policies domaine **fermée** : cinq familles demandées + delivery en bord ; déclencheur / périmètre / relation ; registre non recopié ; topologie non fusionnée.

**Plateforme cartographiée** selon la définition actée : entrée, amont, livraison, compréhension, guards, **et** policies domaine (cette vue).

---

## 11. Journal

| Date | Changement |
|------|------------|
| 2026-08-17 | Création vue policies domaine — lien familles / lots / registre |
| 2026-08-18 | Lecture : inventaire pour décider — [`METHODE.md`](./METHODE.md) |
