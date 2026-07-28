# ADR-20260627 : Guided Document Synthesis G32 v1

## Statut

**Accepté** (27/06/2026)

## Contexte

`document_synthesis` (G30.1) détectait correctement les shells « résume / synthétise », mais le **coût d'échec principal** n'était pas le routage — c'était l'**hallucination** : un résumé plausible sans ancrage dans la source fournie.

G31 a établi le playbook intent family instrumentée. G32 l'applique au domaine doc-first avec un critère de vérité différent : **fidélité à la source** (pas récence produit).

## Décision

Étendre `document_synthesis` avec chaîne guidée complète :

```
intent → slots source → guided_synthesis → contrat → validator groundedness
```

### G32.1 — Slots

| Slot | Rôle |
|------|------|
| `source` | **obligatoire** — passage collé, pièce jointe, URL, briefing |
| `length` | `short` \| `medium` (défaut selon source) |
| `focus` | optionnel — `ideas`, `key_points`, `arguments` |

Absent → `partial_clarify`, gate `document_synthesis_missing_source`

### G32.2 — Stratégie

| Cas | Stratégie | Path |
|-----|-----------|------|
| Source absente | `partial_clarify` | `document_synthesis_clarify` |
| Passage court collé | `deterministic` | `document_synthesis_deterministic` (inchangé) |
| Pièce jointe / LLM | `guided_synthesis` | `document_synthesis_guided` |

**Routing** : `résume` + `document joint` → `document_synthesis` prime sur `document_analysis`.

### G32.3 — Contrat orchestrateur

`GUIDED_DOCUMENT_SYNTHESIS` (priority 712) :

| Contrainte | Valeur |
|------------|--------|
| Web search | **désactivé** (`skipWebSearch: true`) |
| Température | 0.2 |
| Tokens max | 400 (short) / 800 (medium) |

Slots propagés : `packet.meta.document_synthesis_slots`

### G32.4 — Validator post-compose

`documentSynthesisValidator.js` :

| Issue | Détection |
|-------|-----------|
| `generic_synthesis_template` | « Ce document parle de l'importance de… » |
| `insufficient_source_anchoring` | Tokens source absents de la réponse |

Télémétrie : `pipelineTelemetryCtx.documentSynthesisValidation.groundedness`

## Conséquences

### Positives

- Synthèse **governed** : pas de web, clarify explicite sans source
- Deuxième intent family instrumentée — pattern pour G33 (dissertation)
- Composites document+datetime (G30-C4) préservés

### Compromis

- Validator lexical v1 — pas encore MiniCheck/FACTS complet
- Attachment sans texte inline : groundedness limitée au niveau reply

## Validation

```bash
cd server && node --test tests/guided-document-synthesis-g32-policy.test.js
cd server && node --test tests/document-synthesis-g30-policy.test.js
```

Cas matrice : G32-C1 (PJ), G32-C2 (shell sans source)

## Liens

- [[ADR-20260627-Query-Understanding-G29-v1|Query Understanding G29]]
- [[ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- [[ADR-20260627-Guided-Product-Recommendation-G31-v1|G31 — pattern de référence]]
- `server/src/agent/policies/documentSynthesisCompositePolicy.js`
- `server/src/agent/policies/guidedDocumentSynthesisPolicy.js`
- `server/src/agent/policies/documentSynthesisValidator.js`
