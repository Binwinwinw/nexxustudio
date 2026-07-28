# Playbook : Micro-délestage conversationnel

> **Version** : 1.3 | **Date** : 27/05/2026

## Objectif

Vérifier que les requêtes identité, idéation et familiarité restent **déterministes, instantanées et sémantiquement justes** après toute modification du pipeline ou des guards.

## Prérequis

- Serveur Nexxus démarré (`cd server && npm run dev` ou stack équivalente)
- Tests unitaires disponibles

## Checklist rapide (CI / pre-merge)

```bash
cd server
node --test tests/micro-conversation-shortcircuit.test.js
node --test tests/agent-social-identity.test.js
node --test tests/agent-ideation-contract.test.js
node --test tests/agent-familiarity-contract.test.js
node --test tests/agent-familiarity-followup.test.js
node --test tests/conversation-continuity-context.test.js
node --test tests/subject-understanding.test.js
node --test tests/lexicon-learning.test.js
node --test tests/subject-deepening-p3.test.js
node --test tests/request-interpreter-p4.test.js
```

Attendu : **0 fail** (80+ cas familiarité / lexique / P3 / P4).

## Smoke chat (manuel)

| # | Prompt | Console attendue | Réponse attendue |
|---|--------|------------------|------------------|
| 1 | `Comment t'appelles-tu ?` | Réponse sociale déterministe | NEXXUS |
| 2 | `Quel projet IA je pourrais lancer ?` | Idéation ouverte | 3 pistes |
| 3 | `Tu connais l'Italie ?` | Reconnaissance de sujet | `l'Italie`, voyage/culture |
| 4 | `Tu connais le musée du Louvre ?` | Reconnaissance de sujet | visite, pas « configurer » |
| 5 | `est-ce que tu connais Teams 365 ?` | Reconnaissance de sujet | atelier / présentation |
| 6 | `Tu connais mickael jackson et quelques-unes de ses chansons ?` | Entité principale extraite | `Michael Jackson` seul en ouverture — **2 phrases max** |
| 7 | `Tu connais la pétanque ?` | simple_known_subject | `Oui, je connais la pétanque.` — pas « je peux t'aider concernant » |
| 8 | `Tu connais le football ?` | simple_known_subject | reconnaissance brève |
| 9 | `Tu connais l'Italie ?` | simple_known_subject | `l'Italie`, pas paragraphe voyage/culture |
| 10 | `Tu connais le musée du Louvre ?` | simple_known_subject | 2 phrases max, pas offre de visite détaillée |
| 11 | `oui` (après « Tu connais la pétanque ? ») | conversation_continuity | aperçu pétanque — **pas** de refus épistémique |
| 12 | `Tu connais le carnaval ?` (sans lexique) | inferred culturel | reconnaissance + proposition aperçu |
| 13 | `oui` (après carnaval) | déterministe | aperçu shape culturelle — **pas** LLM |
| 14 | `Tu connais Zorbulax ?` + `oui` | P3 borné | aperçu enrichi ou fallback local |
| 15 | `et pour noel tu connais ou pas ?` | P4 respond | reconnaissance Noël directe |
| 16 | `et pour ça tu peux me dire ?` | P4 clarify | « quel sujet exactement ? » |
| 17 | `le truc avec les boules` | P4 confirm | « Tu parles de la pétanque ? » puis `oui` |

## Règle d'ouverture entité + complément

Quand le sujet contient une **personne + complément** (« et ses chansons », « et ses albums », « et quelques chansons ») :

- l'ouverture doit porter sur l'**entité principale** (`subject.label`) ;
- le complément ne doit **jamais** apparaître dans la première phrase ;
- pas de Title Case grotesque sur la phrase complète.

Constante code : `FAMILIARITY_MAIN_ENTITY_OPENING_RULE`. Vérification test : `familiarityUsesMainEntityOpening()`.

## Règle simple_known_subject

Reconnaissance familiarité (`kind: recognition`) → **1–2 phrases max** :

1. `Oui, je connais {label}.`
2. Ouverture légère : « Tu veux que je t'en parle rapidement ? » ou variante courte

**Interdit** : « Je peux t'aider concernant … », paragraphes registre, triple structure.

Constante : `FAMILIARITY_REPLY_MODES.SIMPLE_KNOWN_SUBJECT`.

## Règle follow-up familiarité (`familiarity_followup_no_refusal`)

Après une proposition « Tu veux que je t'en parle rapidement ? », si l'utilisateur répond `oui`, `d'accord`, `parle-m'en`, `dis-m'en plus`, `donne-moi un aperçu` :

- **pas** de refus épistémique ;
- routage `familiarity_followup_deterministic` ;
- réponse : aperçu court depuis le lexique (`D'accord, voici un aperçu rapide…`).

Constantes : `FAMILIARITY_FOLLOWUP_NO_REFUSAL_RULE`, `FAMILIARITY_FOLLOWUP_REPLY_MODE`.

Tests : `agent-familiarity-followup.test.js`.

## Stack familiarité — trois temps

| Temps | Rôle | Variable env |
|-------|------|--------------|
| Subject understanding | Comprendre sans lexique | — |
| Lexique vivant | Promotion gouvernée | `LEXICON_LEARNING=1` |
| P3 borné | Densifier `generic_topic` | `SUBJECT_DEEPENING_LLM=0` pour désactiver |

Matrice follow-up « oui » :

| `resolutionMode` | Voie |
|------------------|------|
| `lexicon` | Aperçu local précis |
| `inferred` | Aperçu shape déterministe |
| `generic` | LLM P3 + fallback |

ADR : [[ADR-20260527-Stack-Familiarite-Trois-Temps]]. Module v1.4 : [[Micro-Conversation-Delestage]].

## P4 — Interprète de requête (candidat skill)

| Brique | Rôle | Variable env |
|--------|------|--------------|
| requestNormalizer | Reformulation fragile | — |
| clarificationPolicy | clarify / confirm / respond | `REQUEST_INTERPRETER=0` pour désactiver |

Doctrine : `REQUEST_INTERPRETER_RULE = fragile_reformulate_ambiguous_clarify`.

Skill candidat : [[skill-request-interpreter]] (`enabled: false` — promotion après observation terrain).

## Diagnostic si échec

1. **Refus épistémique** sur requête banale → vérifier ordre short-circuit **avant** SIMPLE_FAST dans `agentPipeline.js`.
2. **« L Italie »** ou forme cassée → `surfaceFormNormalizer.js` + lexique.
3. **« Je peux t'aider concernant … »** sur reconnaissance simple → `buildSimpleRecognitionReply()` / mode `simple_known_subject`.
4. **« Et Quelques-unes De Ses Chansons »** → `extractMainEntity()` + `normalizeProperNameCase()` + `person_celebrity`.
5. **Route simple_fast** dans logs → `shouldBypassSimpleFast` + contrat `IDEATION_OPEN`.
6. **Clarification** après « oui » sur sujet connu → vérifier `resolveSubjectFromLabel` + overlay `promoted-lexicon.json`.
7. **LLM sur pétanque/carnaval** → P3 ne doit s'activer que si `resolutionMode === generic`.
8. **Sur-clarification** sur requête claire → vérifier `shouldRunInterpreter` / `REQUEST_INTERPRETER=0`.
9. **Confirm sans enchaînement** → phase `subject_confirmation_pending` dans continuité P2.

## Ajout d'un nouveau sujet familiarité

### Voie manuelle (canon)

1. Entrée dans `SUBJECT_LEXICON` (label, category, placeSubtype ou personSubtype, definition).
2. Entrée `CELEBRITY_ALIASES` si alias orthographique ou patron complément.
3. Entrée `SURFACE_FORM_BY_KEY` si forme surface non triviale.
4. Test dans `agent-familiarity-contract.test.js` (inclure patron complément si person_celebrity).
5. Mise à jour note Vault [[Micro-Conversation-Delestage]] si changement de taxonomie.

### Voie gouvernée (runtime)

1. Activer `LEXICON_LEARNING=1` sur l'environnement cible.
2. Laisser le sujet apparaître ≥ 3 fois (sessions distinctes de préférence).
3. Vérifier `server/data/micro/lexicon/learning-events.jsonl`.
4. Valider ou révoquer via `revokePromotedLexiconEntry` si promotion incorrecte.
5. Merge optionnel vers `SUBJECT_LEXICON` après revue humaine.

## Nouveau micro-outil (P1/P2/P3)

Respecter [[Regle-Ancrage-Micro-Outils]] — 5 ancrages minimum + Vault. Template : `_templates/micro-tool-anchoring.md`.

## Liens

- [[ADR-20260601-Micro-Conversation-Delestage]]
- [[ADR-20260527-Stack-Familiarite-Trois-Temps]]
- [[Micro-Conversation-Delestage]]
- [[skill-micro-delestage]]
- [[skill-request-interpreter]]
