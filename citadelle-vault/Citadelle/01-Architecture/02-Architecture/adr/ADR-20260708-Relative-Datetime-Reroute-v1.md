# ADR-20260708 : Relative Datetime Reroute (G19)

## Statut

**Accepté** (08/07/2026)

## Contexte

Extension symétrique de G16 aux temps relatifs/futurs.

Requête : « quel jour sera dans 3 jours » → `datetime_deterministic` répondait « Nous sommes le… » (aujourd'hui).

| Couche | État avant |
|--------|------------|
| P2 | `datetime_deterministic` |
| P3 | Pas de filet sur relative |

## Décision

### P2 — reroute vers `simple_factual_lookup`

- `isRelativeOrFutureDatetimeQuestion()` / `extractTemporalTarget() === relative`
- Patterns : `dans N jours`, `semaine prochaine`, `demain`, `quel jour sera…`
- Exclusion : événements astronomiques (`pleine lune`) → `external_calendar_lookup` prime
- Ordre short-circuit : historical → external_calendar → relative → datetime social
- `resolveRelativeDateAnswer()` — calcul calendaire local `fr-FR`
- Bypass sufficiency gate pour réponse déterministe relative

### P3 — extension `datetime_subject_mismatch`

- `isDatetimeSubjectMismatch` couvre `historical` **et** `relative`
- Surface « nous sommes le… » sur cible non-actuelle → violation

## Conséquences

- Fuseaux horaires complexes : hors périmètre (lot ultérieur)
- Non-régression pleine lune : `external-calendar-lookup-routing.test.js`

## Fichiers

| Fichier | Rôle |
|---------|------|
| `conversationSubjectExtraction.js` | `parseRelativeDayOffset`, guard relative |
| `simpleFactualComposer.js` | `resolveRelativeDateAnswer` |
| `intentShortCircuit.js` | Ordre short-circuit |
| `conversationMoveContractVerification.js` | Filet P3 datetime |

## Références

- [ADR Datetime Historical Reroute](./ADR-20260708-Datetime-Historical-Reroute-v1.md)
- [Conversation Move Governance](../../../docs/agents/conversation-move-governance.md) — § G19
