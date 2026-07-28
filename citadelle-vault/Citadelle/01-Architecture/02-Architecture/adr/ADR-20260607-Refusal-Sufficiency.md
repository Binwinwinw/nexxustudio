# ADR-20260607 : Suffisance avant refus épistémique

**Date** : 05/06/2026  
**Statut** : ✅ Validé — implémenté  
**Règle** : `refusal_only_if_no_safe_useful_answer`  
**Formule** : *intention claire + détails manquants = réponse générale utile, pas refus automatique*

## Contexte

Certaines requêtes **exploitables mais incomplètes** (ex. « comment lancer un projet qui déclenche la Forge ») produisaient le refus canonique *« pas assez d'éléments fiables »* : ambiguïté locale traitée comme absence globale de signal.

Complémentaire à [[02-Architecture/adr/ADR-20260604-Auto-Reply-Sufficiency|suffisance des auto-réponses]] (court-circuits) ; ici le sujet est le **refus épistémique** et les réponses vides sans contexte RAG.

## Décision

Avant tout refus global :

1. Détecter l'**intention dominante** (procédure opérationnelle, idéation, etc.).
2. Évaluer si une **réponse générique sûre** est possible sans inventer.
3. Si oui → **répondre d'abord**, précision optionnelle ensuite.
4. Refuser **uniquement** si même une réponse générale serait trompeuse.

### Cas Forge / projet (référence)

Chemin : cadrage session → validation maturité → handoff Forge (orchestrateur / API / pipeline selon setup). Pas de routes inventées.

### Périmètre élargi (Studio, hors Forge)

`comment faire` + marqueurs **produit** (`session`, `document`, `citadelle`, `vault`, …) → procédure générique Studio, pas refus.  
Hors périmètre (bourse, météo, cuisine, etc.) → refus inchangé.  
`comment créer X` (architecture) reste sur le garde design dédié, pas la procédure Forge.

## Implémentation runtime

| Module | Rôle |
| :--- | :--- |
| `refusalSufficiencyRule.js` | Contrat canon |
| `procedureIntentGuards.js` | Intention procédurale exploitable vs hors périmètre |
| `procedureReplyBuilder.js` | Réponses déterministes |
| `refusalSufficiencyEvaluator.js` | Branche `answer_first` / `refuse` / `defer` |
| `intentShortCircuit.js` | Chemin `procedure_deterministic` (avant social / SIMPLE_FAST) |
| `evaluateEpistemicRefusal` | Exception `minimal_useful_procedure_before_refusal` |
| `ragResponseGate.js` | `proceed` + `groundedHint` si RAG reject + procédure |

Tests : `server/tests/refusal-sufficiency.test.js`

## Extension — nature du sujet avant procédure rapide (06/2026)

**Règle** : `resolve_subject_nature_before_procedure_reply`  
**Formule** : *forme procédurale reconnue + sujet non résolu comme interne = mini-résolution du sujet avant réponse rapide*

| Module | Rôle |
| :--- | :--- |
| `subjectNatureResolver.js` | Extraction de X, nature (interne / entité publique / nom propre / générique) |
| `knownEntityQuickLookup.js` | Registre local + lexique familiarité + inférence de forme |
| `miniResearchGate.js` | Gate local-first (v1 sans web) |
| `procedureReplyBuilder.js` | Gate **avant** `procedure_deterministic` |

Chemins : interne Studio → procédure ; entité publique connue (ex. Need for Speed) → clarification courte ; nom propre non résolu → question ciblée.

Voir [[02-Architecture/adr/ADR-20260608-Subject-Intelligence-Layer|ADR Subject Intelligence Layer]] (couche transverse complète).

### Subject Intelligence Layer (extension — résumé)

| Concept | Détail |
| :--- | :--- |
| `subjectIntelligenceLayer.js` | Façade transverse : nature + **confidence** (`high` / `medium` / `low`) + **usage** implicite |
| Priorité | session projet → registre interne (Forge, Nexxus) → registre public → inférence |
| `subjectNormalizer.js` | `canonical` + alias (`nfs`, `need 4 speed`) |
| `miniResearchGate.resolve()` | `{ candidates[], confidence, needsAsyncWebLookup }` — décision au caller, pas de web bloquant v1 |
| Ton | affirmatif si `high`, hypothétique si `medium` / ambigu (ex. Eclipse) |

Tests : `server/tests/subject-nature-before-procedure.test.js`

## Liens

- [[02-Architecture/adr/ADR-20260604-Auto-Reply-Sufficiency|Auto-reply sufficiency]]
- [[02-Architecture/adr/ADR-20260605-Document-Continuity|Continuité documentaire]]
- [[02-Architecture/adr/ADR-20260601-Memoire-Fil|Mémoire de fil]]
