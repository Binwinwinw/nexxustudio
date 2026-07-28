# ADR-20260708 : Datetime Historical Reroute (G16)

## Statut

**Accepté** (08/07/2026) — rétro-documentation

## Contexte

Requête : « pourrais tu trouver quel jour était le 19 juin 1980 ? »

| Couche | État avant |
|--------|------------|
| P2 | `datetime_deterministic` (mauvais couloir) |
| P3 | Réponse « Nous sommes le mercredi 8 juillet 2026 » |

Bug : subject mismatch — bonne famille datetime, mauvaise cible (aujourd'hui vs 19/06/1980).

## Décision

### P2 — reroute vers `simple_factual_lookup`

- `isHistoricalDateQuestion()` / `extractTemporalTarget() === historical`
- Désactive `asksDate` dans `conversationIntentFrame.js`
- Short-circuit historique **avant** `external_calendar` et `datetime_deterministic`
- Exclusion `isHistoricalDateQuestion()` des guards `externalCalendarLookupIntentGuards`
- Bypass sufficiency gate pour réponse déterministe (`resolveHistoricalWeekdayAnswer`)

### P3 — filet `datetime_subject_mismatch`

- Profil `datetime_deterministic` dans `verifyMoveContract()`
- Détection : surface « nous sommes le… » sur date passée ciblée
- Enforcement : `enforceSimpleFactualDirectness` → « Le 19 juin 1980 était un jeudi. »

## Conséquences

- `datetime_deterministic` reste pour « maintenant »
- Dates passées explicites → `simple_factual_lookup`
- Tests : `conversation-move-contract-verification.test.js` § G16

## Fichiers

| Fichier | Rôle |
|---------|------|
| `conversationSubjectExtraction.js` | `extractTemporalTarget`, historical |
| `simpleFactualComposer.js` | `resolveHistoricalWeekdayAnswer`, `isDatetimeSubjectMismatch` |
| `intentShortCircuit.js` | Ordre short-circuit |
| `conversationMoveContractVerification.js` | Profil datetime P3 |

## Références

- [Conversation Move Governance](../../../docs/agents/conversation-move-governance.md) — § G16
