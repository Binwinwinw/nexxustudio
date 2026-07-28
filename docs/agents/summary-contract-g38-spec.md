# G38 — Summary Contract Router — Spec fonctionnelle

**État** : juillet 2026 — **spec figée** ; router + tests **livrés** (47/47).

**Référence noyau** : [query-understanding-g29-spec.md](./query-understanding-g29-spec.md)

**Modules cibles** (post-implémentation) :
- `server/src/agent/policies/summaryContractRouter.js` — classification unique `summary/*`
- `server/src/agent/policies/culturalContentSummaryPolicy.js` — détecteur spécialisé G37 (appelé par le router)
- `server/src/agent/policies/documentSynthesisCompositePolicy.js` — slots source G30 (appelé par le router)
- `server/src/agent/policies/clarificationDecisionPolicy.js` — gate branchée sur le **contrat**, pas sur heuristiques éparses

**Tests cibles** :
- `server/tests/summary-contract-g38-routing.test.js` — batterie table-driven (§ Cas de test)

**Voir aussi** :
- [nexxus-routing-behavior-registry-v1.md](./nexxus-routing-behavior-registry-v1.md) — pack G38
- G37 livré : `cultural-content-summary-routing.test.js`

---

## Problème adressé

« Résumer X » n'est pas une tâche unique. Les systèmes qui confondent :

- **résumé de connaissance du monde** (« résume Interstellar »)
- **compression d'un texte fourni** (« résume ce passage » + bloc)

…produisent des demandes de document absurdes sur des entités culturelles connues, ou des résumés hallucinés sans source.

**Règle centrale** : la décision « faut-il demander un texte ? » appartient au **router** (Plan A), jamais aux agents de génération (Plan B/C).

---

## Doctrine

| Principe | Description |
|----------|-------------|
| **Contrat avant heuristique** | Le JSON `SummaryContract` est l'interface inter-plans ; les parseurs (`extractCulturalSummarySubject`, `hasDocumentAnchor`, …) sont des détails d'implémentation remplaçables. |
| **Smart par défaut** | Entité culturelle nommée sans ancre documentaire → `summary/known_entity`, réponse directe. |
| **Sûr sur ambiguïté bloquante** | « Résume ce livre » sans titre, « résume ce passage » sans contenu → clarification **ciblée** une fois. |
| **Ordre des branches** | Source explicite (texte / PJ / URL) **avant** known_entity — sinon un passage collé sur Interstellar bascule à tort. |
| **Invariant gravé** | `intent === summary/known_entity` ⇒ `routing.forbidDocumentRequest === true` — **aucun agent aval ne peut surcharger**. |

---

## Famille d'intentions `summary/*`

| Intent | Exemple | Source requise | Contract |
|--------|---------|------------------|----------|
| `summary/known_entity` | « résume le film Interstellar » | Non | `DIRECT_SUMMARY` |
| `summary/user_provided_text` | « résume ce texte » + bloc / PJ | Oui (texte ou fichier) | `TEXT_SUMMARY` |
| `summary/web_page` | « résume cette page » + URL | Oui (URL) | `WEB_SUMMARY` |
| `summary/excerpt_or_chapter` | « résume le chapitre 3 » + PJ / passage | Oui si fidélité passage ; sinon fallback | `TEXT_SUMMARY` ou clarify |
| `summary/ambiguous` | « résume ce livre » (sans titre ni source) | Indéterminée | `CLARIFY_SUMMARY_KIND` |

**Note télémétrie** : `summary/excerpt_or_chapter` partage le contrat `TEXT_SUMMARY` avec `user_provided_text` mais expose `entity.kind = "chapter"` et `resolution.strategy = "excerpt_with_source"` pour distinguer les métriques.

---

## Schéma JSON — `SummaryContract`

Contrat léger, versionné. Toute classification `summary/*` **doit** produire cet objet (ou `null` si pas une requête summary).

```json
{
  "$schema": "summary-contract/v1",
  "family": "summary",
  "intent": "summary/known_entity",
  "contract": "DIRECT_SUMMARY",
  "version": 1,

  "entity": {
    "kind": "film",
    "label": "Interstellar",
    "confidence": 0.92
  },

  "source": {
    "type": "knowledge_base",
    "required": false,
    "provided": false,
    "url": null,
    "missing_reason": null
  },

  "constraints": {
    "fidelity": "factual_overview",
    "max_sentences": 5,
    "spoiler_level": "low",
    "copyright_tier": "cultural_work_public_knowledge",
    "mode": null
  },

  "resolution": {
    "strategy": "smart_default_known_entity",
    "reason": "cultural_work_marker + extractable_subject, no document anchor"
  },

  "routing": {
    "plan": "B",
    "pipelinePath": "cultural_content_summary",
    "mode": "SIMPLE_FAST",
    "forbidDocumentRequest": true,
    "forbidWebSearch": true,
    "fetchRequired": false
  },

  "clarification": {
    "needed": false,
    "question": null,
    "options": []
  }
}
```

### Champs obligatoires

| Champ | Type | Description |
|-------|------|-------------|
| `family` | `"summary"` | Famille G29 |
| `intent` | enum § Famille | Sous-intent summary |
| `contract` | enum § Contracts | Contrat d'exécution |
| `source.type` | enum § Source types | Nature de la source |
| `source.required` | `boolean` | Le router exige-t-il une source ? |
| `source.provided` | `boolean` | Source présente dans le tour ? |
| `source.missing_reason` | `string \| null` | Raison télémétrie si `required && !provided` |
| `resolution.strategy` | enum § Resolution strategies | Pourquoi ce chemin a été choisi |
| `resolution.reason` | `string` | Explication courte (debug / métriques) |
| `routing.plan` | `"A" \| "B" \| "C"` | Plan Nexxus cible |
| `routing.pipelinePath` | `string` | Path Plan B/C |
| `routing.forbidDocumentRequest` | `boolean` | **Invariant** pour known_entity |
| `clarification.needed` | `boolean` | Gate Plan A |

### Champs optionnels

| Champ | Description |
|-------|-------------|
| `entity` | Renseigné pour known_entity / excerpt (kind, label, confidence) |
| `constraints` | Paramètres prompt (fidélité, longueur, copyright) |
| `routing.mode` | `SIMPLE_FAST`, `DOCUMENT`, `INSTANT` |
| `routing.fetchRequired` | `true` pour web_page (fetch HTML amont) |
| `clarification.question` / `options` | Clarification ciblée |

---

## Enums

### Contracts

| Valeur | Intent(s) | Fidélité attendue |
|--------|-----------|-------------------|
| `DIRECT_SUMMARY` | `known_entity` | Aperçu factuel, savoir global, pas de texte source |
| `TEXT_SUMMARY` | `user_provided_text`, `excerpt_or_chapter` | Compression **fidèle** au texte fourni |
| `WEB_SUMMARY` | `web_page` | Structure article + idées clés (HTML nettoyé) |
| `CLARIFY_SUMMARY_KIND` | `ambiguous` | Pas d'exécution — gate clarification |

> **Distinction WEB_SUMMARY / TEXT_SUMMARY** : même exécuteur initial possible (`document_synthesis_llm`), mais contrats, validators et prompts **différents**. `WEB_SUMMARY` autorise fetch + focus structure ; `TEXT_SUMMARY` interdit d'ajouter des faits hors source.

### Source types

| Valeur | Description |
|--------|-------------|
| `knowledge_base` | Pas de document — savoir global (known_entity) |
| `pasted` | Texte collé dans l'utterance |
| `attachment` | Fichier / PJ |
| `url` | URL explicite |
| `briefing` | Continuité document session (G32 briefing) |
| `none` | Aucune source (clarify) |

### `source.missing_reason`

| Valeur | Contexte |
|--------|----------|
| `document_anchor_without_content` | « ce passage », « ce texte » sans bloc / PJ |
| `url_expected_absent` | Shell web (« cette page ») sans URL |
| `chapter_reference_without_source` | « chapitre N » sans PJ / passage |
| `ambiguous_work_reference` | « ce livre », « cette œuvre » sans titre |
| `shell_without_any_source` | Shell résumé seul, sujet non extractible |

### Resolution strategies

| Valeur | Signification |
|--------|---------------|
| `explicit_source_provided` | Texte / PJ / URL détectés — priorité compression |
| `cultural_entity_detected` | G37 — marqueur œuvre + sujet |
| `smart_default_known_entity` | Sujet extractible, pas d'ancre doc, pas de PJ (policy déclarée) |
| `web_url_detected` | URL + intent page web |
| `excerpt_with_source` | Chapitre / extrait avec source fournie |
| `excerpt_missing_source` | Référence chapitre sans source → clarify |
| `ambiguous_requires_clarify` | Référence vague œuvre — clarify_then_build |
| `missing_source_clarify` | Shell + ancre doc, contenu absent |

---

## Invariants (à graver)

```
INV-1  intent === "summary/known_entity"
       ⇒ routing.forbidDocumentRequest === true
       ⇒ clarification.needed === false
       ⇒ aucun agent aval (COMPOSER, DOCUMENT, validators) ne peut demander un document

INV-2  intent === "summary/user_provided_text" | "summary/excerpt_or_chapter"
       ET source.required === true ET source.provided === false
       ⇒ clarification.needed === true
       ⇒ la demande de texte émane du router (Plan A), jamais d'un agent généraliste

INV-3  intent === "summary/web_page"
       ET URL absente
       ⇒ source.missing_reason === "url_expected_absent"
       ⇒ clarification ciblée URL (pas « colle un document » générique)

INV-4  Ordre de classification :
       explicit_source_provided > web_url_detected > cultural_entity_detected
       > excerpt_missing_source > ambiguous_requires_clarify > smart_default_known_entity

INV-5  contract === "WEB_SUMMARY" ≠ contract === "TEXT_SUMMARY"
       même si pipelinePath initial identique — télémétrie et prompt distincts

INV-6  Smart default (policy déclarée, pas effet de bord parseur) :
       shell résumé + sujet extractible (confidence ≥ 0.7)
       + aucune ancre documentaire + aucune PJ + pas d'URL
       ⇒ summary/known_entity via resolution.strategy = "smart_default_known_entity"
```

---

## Algorithme de classification (pseudo-code)

```javascript
function classifySummaryContract(query, { attachments = [], history = [] }) {
  if (!hasSummaryShell(query)) return null;

  const pasted = extractPastedSourceText(query);
  const url = extractUrl(query);
  const hasAttachment = attachments.length > 0;
  const documentAnchor = hasDocumentAnchor(query);
  const chapterRef = hasChapterReference(query);
  const webIntent = hasWebPageSummaryIntent(query); // "cette page", "cet article", URL

  // ── Branche 1 : source explicite (priorité maximale) ──
  if (pasted || hasAttachment) {
    if (chapterRef) {
      return contract({
        intent: "summary/excerpt_or_chapter",
        contract: "TEXT_SUMMARY",
        resolution: { strategy: "excerpt_with_source" },
        source: { type: pasted ? "pasted" : "attachment", required: true, provided: true },
        routing: { pipelinePath: "document_synthesis_llm", mode: "DOCUMENT" },
      });
    }
    return contract({
      intent: "summary/user_provided_text",
      contract: "TEXT_SUMMARY",
      resolution: { strategy: "explicit_source_provided" },
      source: { type: pasted ? "pasted" : "attachment", required: true, provided: true },
      routing: { pipelinePath: "document_synthesis_llm", mode: "DOCUMENT" },
    });
  }

  // ── Branche 2 : page web ──
  if (url || webIntent) {
    if (!url) {
      return clarify({
        intent: "summary/web_page",
        contract: "WEB_SUMMARY",
        resolution: { strategy: "missing_source_clarify" },
        source: {
          type: "url", required: true, provided: false,
          missing_reason: "url_expected_absent",
        },
      });
    }
    return contract({
      intent: "summary/web_page",
      contract: "WEB_SUMMARY",
      resolution: { strategy: "web_url_detected" },
      source: { type: "url", required: true, provided: true, url },
      routing: { pipelinePath: "document_synthesis_llm", mode: "DOCUMENT", fetchRequired: true },
    });
  }

  // ── Branche 3 : known_entity (G37 + smart default) ──
  if (isCulturalContentSummaryRequest(query, attachments)) {
    return contract({
      intent: "summary/known_entity",
      contract: "DIRECT_SUMMARY",
      resolution: { strategy: "cultural_entity_detected" },
      entity: extractCulturalSummarySubject(query),
      routing: {
        pipelinePath: "cultural_content_summary",
        mode: "SIMPLE_FAST",
        forbidDocumentRequest: true,
      },
    });
  }

  // ── Branche 4 : excerpt sans source ──
  if (chapterRef || documentAnchor) {
    return clarify({
      intent: chapterRef ? "summary/excerpt_or_chapter" : "summary/user_provided_text",
      contract: chapterRef ? "TEXT_SUMMARY" : "TEXT_SUMMARY",
      resolution: {
        strategy: chapterRef ? "excerpt_missing_source" : "missing_source_clarify",
      },
      source: {
        type: "none", required: true, provided: false,
        missing_reason: chapterRef
          ? "chapter_reference_without_source"
          : "document_anchor_without_content",
      },
    });
  }

  // ── Branche 5 : ambiguïté bloquante ──
  if (hasVagueWorkReference(query) && !extractCulturalSummarySubject(query)) {
    return clarify({
      intent: "summary/ambiguous",
      contract: "CLARIFY_SUMMARY_KIND",
      resolution: { strategy: "ambiguous_requires_clarify" },
      source: { missing_reason: "ambiguous_work_reference" },
      clarification: {
        question: "Veux-tu un résumé général de l'œuvre, ou que je résume un texte précis que tu me fourniras ?",
        options: ["summary/known_entity", "summary/user_provided_text"],
      },
    });
  }

  // ── Branche 6 : smart default ──
  const subject = extractCulturalSummarySubject(query);
  if (subject && subjectConfidence(subject) >= 0.7) {
    return contract({
      intent: "summary/known_entity",
      contract: "DIRECT_SUMMARY",
      resolution: { strategy: "smart_default_known_entity" },
      entity: { label: subject },
      routing: { forbidDocumentRequest: true, pipelinePath: "cultural_content_summary" },
    });
  }

  // ── Branche 7 : shell résumé sans rien ──
  if (hasDocumentSynthesisShell(query)) {
    return clarify({
      intent: "summary/user_provided_text",
      resolution: { strategy: "missing_source_clarify" },
      source: { missing_reason: "shell_without_any_source" },
    });
  }

  return null;
}
```

---

## Matrice de routage — Type de X × Source

| Type de X | Source dispo | Intent | Contract | `pipelinePath` | Demande source ? | `forbidDocumentRequest` |
|-----------|--------------|--------|----------|----------------|------------------|-------------------------|
| Film connu (Interstellar) | aucune | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | Non | **true** |
| Livre connu (Dune) | aucune | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | Non | **true** |
| Œuvre sans marqueur explicite | aucune | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | Non | **true** |
| Concept / événement historique | aucune | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` ou `general_knowledge_*` | Non | **true** |
| Passage collé | texte | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_llm` | Non | false |
| PDF / fichier joint | PJ | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_llm` | Non | false |
| Chapitre + PJ | PJ | `excerpt_or_chapter` | `TEXT_SUMMARY` | `document_synthesis_llm` | Non | false |
| Chapitre sans source | aucune | `excerpt_or_chapter` | clarify | `document_synthesis_clarify` | Oui (router) | false |
| Page web | URL | `web_page` | `WEB_SUMMARY` | `document_synthesis_llm` + fetch | Non | false |
| Page web sans URL | aucune | `web_page` | clarify | `document_synthesis_clarify` | Oui (URL) | false |
| « Ce livre » sans titre | aucune | `ambiguous` | `CLARIFY_SUMMARY_KIND` | `clarification_gate` | Question ciblée | false |
| « Ce passage » sans texte | aucune | `user_provided_text` | clarify | `document_synthesis_clarify` | Oui (texte) | false |
| Shell seul, sujet inconnu | aucune | `user_provided_text` | clarify | `document_synthesis_clarify` | Oui | false |

---

## Branchement Plans A / B / C

```
Plan A (agentPipeline.run)
  └─ summaryContractRouter.classifySummaryContract()
       ├─ clarification.needed → clarificationDecisionPolicy (signaux contractuels)
       └─ sinon → propagation contract dans pipelineTelemetryCtx.summaryContract

Plan B (intentShortCircuit)
  ├─ DIRECT_SUMMARY     → cultural_content_summary (SIMPLE_FAST, G37)
  ├─ TEXT_SUMMARY       → document_synthesis_* (G30/G32)
  ├─ WEB_SUMMARY        → document_synthesis_llm + fetch (contrat WEB distinct)
  └─ CLARIFY_*          → document_synthesis_clarify ou clarification_gate

Plan C (orchestrateur)
  └─ Uniquement si escalade explicite — jamais pour known_entity (G37 interdit deferToFullPipeline)
```

### Signaux `clarificationDecisionPolicy` (cibles G38)

| Signal | Condition |
|--------|-----------|
| `summary_known_entity_answerable` | `intent === summary/known_entity` → `CAN_ANSWER_NOW` |
| `summary_missing_source` | `source.required && !source.provided` → `NEEDS_CLARIFICATION` |
| `summary_ambiguous_kind` | `intent === summary/ambiguous` → `NEEDS_CLARIFICATION` |

---

## Templates de prompt (par contract)

### `DIRECT_SUMMARY`

```
Donne un résumé concis et factuel de [entity.label] ([entity.kind]),
en [langue], sans spoiler excessif, en [constraints.max_sentences] phrases maximum.
Ne demande pas de document. N'ajoute pas de faits non vérifiables.
```

### `TEXT_SUMMARY`

```
Voici un texte fourni par l'utilisateur. Résume-le en [N] points.
N'ajoute aucune information absente du texte. Reste fidèle au passage.
```

### `WEB_SUMMARY`

```
Voici le contenu principal d'une page web (HTML nettoyé).
Résume l'article en [constraints.max_sentences] phrases : structure, idées clés, conclusion.
Résumé court — pas de reprise intégrale.
```

---

## Copyright / granularité (heuristiques contractuelles)

| `copyright_tier` | `max_sentences` | `spoiler_level` | Cas |
|------------------|-----------------|-------------------|-----|
| `cultural_work_public_knowledge` | 5 | `low` | Film/livre connu |
| `user_provided_content` | 12 | `n/a` | Texte collé / PJ |
| `public_web_article` | 8 | `n/a` | Page web |
| `recent_cultural_work` | 4 | `minimal` | Œuvre récente (heuristique année si dispo) |

---

## Cas de test — batterie table-driven (30)

Format attendu des tests `summary-contract-g38-routing.test.js` :

```javascript
{ id, query, attachments?, expect: { intent, contract, pipelinePath?, clarification?, forbidDocumentRequest?, resolutionStrategy?, missingReason? } }
```

| ID | Requête (résumé) | Intent | Contract | Path | Clarify | `forbidDoc` | `resolution.strategy` |
|----|------------------|--------|----------|------|---------|-------------|------------------------|
| G38-T01 | « pourrais-tu faire un résumé du film Interstellar ? » | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | non | true | `cultural_entity_detected` |
| G38-T02 | « résume Dune » | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | non | true | `smart_default_known_entity` |
| G38-T03 | « fais un résumé de la série Breaking Bad » | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | non | true | `cultural_entity_detected` |
| G38-T04 | « résume le roman 1984 » | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | non | true | `cultural_entity_detected` |
| G38-T05 | « synthèse du documentaire Cosmos » | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | non | true | `cultural_entity_detected` |
| G38-T06 | « résume l'histoire de la Révolution française » | `known_entity` | `DIRECT_SUMMARY` | `cultural_content_summary` | non | true | `smart_default_known_entity` |
| G38-T07 | « résume ce passage : [bloc ≥12 mots] » | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_llm` | non | false | `explicit_source_provided` |
| G38-T08 | « résume ce texte » (sans bloc) | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_clarify` | oui | false | `missing_source_clarify` |
| G38-T09 | « résume ce texte » + PJ | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_llm` | non | false | `explicit_source_provided` |
| G38-T10 | « résume le document joint » + PJ | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_llm` | non | false | `explicit_source_provided` |
| G38-T11 | « résume ce passage » sans contenu | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_clarify` | oui | false | `missing_source_clarify` |
| G38-T12 | missing_reason T11 | — | — | — | — | — | `document_anchor_without_content` |
| G38-T13 | « résume cette page https://example.com/article » | `web_page` | `WEB_SUMMARY` | `document_synthesis_llm` | non | false | `web_url_detected` |
| G38-T14 | « résume cette page » (sans URL) | `web_page` | `WEB_SUMMARY` | `document_synthesis_clarify` | oui | false | `missing_source_clarify` |
| G38-T15 | missing_reason T14 | — | — | — | — | — | `url_expected_absent` |
| G38-T16 | « résume cet article : https://… » | `web_page` | `WEB_SUMMARY` | `document_synthesis_llm` | non | false | `web_url_detected` |
| G38-T17 | « résume le chapitre 3 » + PJ | `excerpt_or_chapter` | `TEXT_SUMMARY` | `document_synthesis_llm` | non | false | `excerpt_with_source` |
| G38-T18 | « résume le chapitre 3 de Dune » sans PJ | `excerpt_or_chapter` | `TEXT_SUMMARY` | `document_synthesis_clarify` | oui | false | `excerpt_missing_source` |
| G38-T19 | missing_reason T18 | — | — | — | — | — | `chapter_reference_without_source` |
| G38-T20 | « résume ce livre » (sans titre) | `ambiguous` | `CLARIFY_SUMMARY_KIND` | `clarification_gate` | oui | false | `ambiguous_requires_clarify` |
| G38-T21 | missing_reason T20 | — | — | — | — | — | `ambiguous_work_reference` |
| G38-T22 | « résume cette œuvre » sans précision | `ambiguous` | `CLARIFY_SUMMARY_KIND` | `clarification_gate` | oui | false | `ambiguous_requires_clarify` |
| G38-T23 | « résume ce passage sur Interstellar : [bloc] » | `user_provided_text` | `TEXT_SUMMARY` | `document_synthesis_llm` | non | false | `explicit_source_provided` |
| G38-T24 | T23 ne doit **pas** être `known_entity` | — | — | — | — | — | priorité source > entité |
| G38-T25 | « résume » seul | `user_provided_text` | clarify | `document_synthesis_clarify` | oui | false | `missing_source_clarify` |
| G38-T26 | missing_reason T25 | — | — | — | — | — | `shell_without_any_source` |
| G38-T27 | Interstellar : `evaluateClarificationDecision` → `CAN_ANSWER_NOW` | — | — | — | non | true | — |
| G38-T28 | Interstellar : pas `document_synthesis_clarify` | — | — | — | — | — | régression G37 |
| G38-T29 | T08 : signal `summary_missing_source` | — | — | — | oui | — | — |
| G38-T30 | T20 : options clarify `known_entity` \| `user_provided_text` | — | — | — | oui | — | — |

### Non-régression obligatoire

- G37 `cultural-content-summary-routing.test.js` — **7/7** inchangés
- G35 `social-pattern-hardening.test.js` — pas de régression
- G32 passage collé — reste `TEXT_SUMMARY`, pas `known_entity`

---

## Ordre d'implémentation (G38)

| Étape | Livrable | Statut |
|-------|----------|--------|
| 1 | Spec G38 (ce document) + section G29 | **figé** |
| 2 | `summary-contract-g38-routing.test.js` — 30 cas table-driven (rouge → vert) | **livré** (47 tests) |
| 3 | `summaryContractRouter.js` — `classifySummaryContract()` | **livré** |
| 4 | Refactor G37 — détecteur appelé par router, pas îlot | partiel (G37 consommé par router) |
| 5 | `clarificationDecisionPolicy` — signaux contractuels | **livré** |
| 6 | `pipelineTelemetryCtx.summaryContract` | **livré** |
| 7 | `intentShortCircuit` contract-driven | **livré** |
| 8 | Prompts distincts WEB_SUMMARY vs TEXT_SUMMARY | **livré** (G38.1) |

---

## Télémétrie cible

| Signal | Où |
|--------|-----|
| `summaryContract.intent` | `pipelineTelemetryCtx` |
| `summaryContract.contract` | `pipelineTelemetryCtx` |
| `summaryContract.resolutionStrategy` | `pipelineTelemetryCtx` |
| `summaryContract.resolutionReason` | `pipelineTelemetryCtx` |
| `summaryContract.pipelinePath` | `pipelineTelemetryCtx` |
| `summaryContract.forbidDocumentRequest` | `pipelineTelemetryCtx` + audit INV-1 |
| `summaryContract.fetchRequired` | `pipelineTelemetryCtx` |
| `summaryContract.sourceType` | `pipelineTelemetryCtx` |
| `summaryContract.sourceProvided` / `sourceRequired` | `pipelineTelemetryCtx` |
| `summaryContract.missingReason` | `pipelineTelemetryCtx` + métriques clarification |
| `summaryContract.clarificationNeeded` | `pipelineTelemetryCtx` |
| `summaryContract.entityLabel` / `entityKind` | `pipelineTelemetryCtx` |
| Console `[SUMMARY_CONTRACT]` | `recordSummaryContractTelemetry()` — phases `classify` + `route` |

**Module** : `server/src/agent/telemetry/summaryContractTelemetry.js`

**Phases** :
- `classify` — amont Plan A (`agentPipeline` après query understanding)
- `route` — après match short-circuit contract-driven

---

## Résumé en une phrase

G38 fige le contrat `summary/*` pour que Nexxus sache **avant tout agent** si une requête « résumer » exige un texte, une URL, ou une réponse directe de connaissance — avec smart default déclaré et clarification uniquement sur ambiguïté bloquante.
