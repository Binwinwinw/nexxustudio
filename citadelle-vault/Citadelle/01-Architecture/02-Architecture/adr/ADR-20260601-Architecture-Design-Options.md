# ADR-20260601 : Doctrine « comment créer X » — options d'architecture, pas sur-promesse d'exécution

## Statut
**Validé** (01/06/2026)

## Contexte

Des requêtes de **conception** du type « comment créer un code-reviewer qui analyse tout le code… » étaient incorrectement routées vers le pipeline lourd **EXPERT_TASK / EPISTEMIC / DIAGNOSTIC** (planner, agents spécialisés, budget ~70 s).

Symptômes observés en production :

1. **Sur-promesse d'exécution** — affirmation de `skill-industrial-maturation`, de l'orchestrateur ou d'une indexation complète sans preuve runtime (`requiresRuntime: false`, modules non implémentés).
2. **Voie unique imposée** — une seule piste d'exécution au lieu de 2–3 approches comparables.
3. **Absence de cadrage** — pas de distinction architecture conceptuelle / prototype / implémentation complète.
4. **Mismatch intention ↔ pipeline** — l'utilisateur demandait des **idées et des approches**, pas le lancement d'une usine.

Cause racine : le garde unifié `isAnalyticalTechnicalRequest()` matche les tokens `code`, `analyse`, `architecture` et force **EXPERT_TASK**, même lorsque la forme surface est une question de **design** (« comment créer… »).

Cette dérive contredit la [[ADR-011-DISCIPLINE-EPISTEMIQUE|discipline épistémique fail-closed]] et [[ADR-007-Skills-Architecture|l'architecture des Skills]] : un skill prompt-only ne peut pas être présenté comme exécutable au runtime.

## Décision

Introduire une **doctrine à quatre niveaux** pour les demandes de conception « comment créer X » (et formulations voisines) :

> **Formule opérationnelle** : pour « comment créer X », Nexxus propose **3 approches cadrées** et **n'affirme plus de capacités non prouvées**.

### 1. Détection — `architectureDesignIntentGuards.js`

| Élément | Valeur |
|---------|--------|
| Règle | `architecture_options_not_execution` |
| Patterns | `comment créer/construire…`, `how to build…`, `je veux créer…`, `quelle architecture pour…`, `plusieurs solutions/approches` |
| Exclusions | exécution immédiate (`lance`, `indexe ce`, `corrige ce`), debug (`stack trace`, `line `), requêtes > 120 mots |
| Signaux | `explorable` (sujet identifiable) \| `vague` (cadrage seul) |

**Ne pas confondre** avec `isDesignCreateIntent` (Nexxus Design UI/DA) ni `isIdeationIntent` (idéation projet ouverte générique).

### 2. Routage — short-circuit + contrat registry

**Short-circuit** (`intentShortCircuit.js`) — chemin `architecture_design_deterministic` :

```
P4 Interprète → Continuité P2 → architecture_design_deterministic → (stop LLM lourd)
```

Ordre : **après** P4, **avant** idéation et familiarité (conception plus spécifique que idéation générique).

**Intent Contract Registry** — entrée `ARCHITECTURE_OPTIONS` :

| Champ | Valeur |
|-------|--------|
| `priority` | **910** (au-dessus de `IDEATION_OPEN` 900) |
| `responseMode` | `OPEN_PROPOSITION` |
| `routing.maxActiveExperts` | 0 |
| `routing.orchestratorMode` | `IDEATION` |
| `routing.skipWebSearch` | oui |
| Garde | `isArchitectureDesignIntent` |

**Intent classifier** — `isArchitectureDesignIntent` → `normal_conversation` (budget 1), **avant** `isAnalyticalTechnicalRequest`.

**Garde analytique** — `isAnalyticalTechnicalRequest` retourne `false` si `isArchitectureDesignIntent` est vrai (évite le contrat `DIAGNOSTIC`).

### 3. Contrat de réponse — `OPEN_PROPOSITION`

Réponse déterministe (`buildArchitectureDesignOptionsReply`) :

1. **Approche légère** (script + LLM local) — premier pas concret.
2. **Approche intermédiaire** (RAG + règles) — premier pas concret.
3. **Approche industrielle** (pipeline complet) — réservée si besoin d'échelle avéré.

Clôture obligatoire : question de cadrage (architecture conceptuelle / prototype / implémentation complète).

Prompts `COMPOSER` et `OPEN_PROPOSITION` enrichis : **interdiction** d'affirmer l'exécution d'un `skill-*` ou de l'orchestrateur sans preuve runtime.

### 4. Fail-closed comportemental — `skillExecutionClaimGuard.js`

| Élément | Valeur |
|---------|--------|
| Règle | `no_unverified_skill_execution_claims` |
| Vérification | registre `skillRuntimeRegistry.js` — skill exécutable ⟺ `requiresRuntime !== false` **et** au moins un `runtimeModules[].status === "implemented"` |
| Point d'application | `enforceModeContract()` — remplace la réponse par fallback options si violation détectée |

**Double défense** :

- **Chemin nominal** : short-circuit déterministe sans sur-promesse.
- **Filet de sécurité** : sanitisation post-renderer si le LLM contourne le short-circuit.

## Formulations couvertes (v1)

| Formulation | Attendu |
|-------------|---------|
| « comment créer un code-reviewer… » | 3 approches + cadrage |
| « comment mettre en place un agent… » | idem |
| « quelle architecture pour un pipeline RAG… » | idem |
| « propose plusieurs approches pour… » | idem |
| « lance l'indexation de mon projet » | **hors scope** — exécution, pas conception |
| « debug cette erreur api » | **hors scope** — `DIAGNOSTIC` |

## Conséquences

### Positives

- Alignement intention utilisateur ↔ routage ↔ contrat ↔ garde-fou anti-promesse.
- TTFT quasi nul sur les demandes de conception reconnues (réponse déterministe).
- Réutilisable pour d'autres formulations via extension des patterns (sans nouveau pipeline).
- Traçabilité tests : `architecture-design-intent.test.js`, `skill-execution-claim-guard.test.js`.

### Compromis

- Chevauchement partiel avec `IDEATION_OPEN` — mitigé par priorité 910 et garde dédiée.
- Lexique sujet (code-reviewer, agent, pipeline…) à enrichir progressivement.
- Le fallback sanitizer est générique — une réponse LLM valide mais mentionnant un skill en lecture seule pourrait être remplacée si patterns d'exécution matchent.

## Implémentation (référence code)

| Fichier | Rôle |
|---------|------|
| `server/src/agent/utils/architectureDesignIntentGuards.js` | Détection + réponses déterministes |
| `server/src/agent/utils/skillExecutionClaimGuard.js` | Fail-closed anti-promesse skill |
| `server/src/agent/micro/classifiers/intentShortCircuit.js` | Short-circuit `architecture_design_deterministic` |
| `server/src/agent/micro/replies/architectureDesignReplyBuilder.js` | Wrapper réponse micro |
| `server/src/agent/config/intentContractRegistry.js` | Contrat `ARCHITECTURE_OPTIONS` |
| `server/src/agent/utils/conversationGuards.js` | Exclusion garde analytique |
| `server/src/agent/utils/intentClassifier.js` | Routage `normal_conversation` |
| `server/src/agent/config/modeResponseContracts.js` | Prompts + sanitizer + exception épistémique |

## Validation

```bash
cd server && node --test tests/architecture-design-intent.test.js
cd server && node --test tests/skill-execution-claim-guard.test.js
cd server && node --test tests/micro-conversation-shortcircuit.test.js
cd server && node --test tests/intent-contract-registry.test.js
```

Requête terrain :

> comment créer un code-reviewer qui analyse tout le code d'un projet, identifie les erreurs et propose plusieurs solutions selon la logique de dev senior

Attendu :

| Critère | Valeur |
|---------|--------|
| Chemin pipeline | `architecture_design_deterministic` |
| Contrat registry | `ARCHITECTURE_OPTIONS` |
| Intent classifier | `normal_conversation` (≠ `expert_task`) |
| Contenu | 3 approches + question de cadrage |
| Interdit | `skill-industrial-maturation`, « via l'orchestrateur », « je lance l'indexation » |

## Plan d'extension

| Phase | Scope |
|-------|-------|
| **v1.0** ✅ | Garde + short-circuit + contrat + sanitizer + tests |
| **v1.1** ✅ | Smoke registry (`architectureDesignSmokeV1_1.js`) — 7 formulations + 2 exclusions |
| **v1.2** | Skill candidat `skill-architecture-options` si critères promotion terrain remplis |

Voir [[ADR-20260601-Conversation-Momentum-P5|P5 Élan conversationnel]] pour la recommandation par défaut et le prochain pas concret.

## Liens

- [[ADR-20260527-Intent-Contract-Registry|Intent Contract Registry]]
- [[ADR-20260601-Micro-Conversation-Delestage|Micro-délestage conversationnel]]
- [[ADR-011-DISCIPLINE-EPISTEMIQUE|Discipline épistémique]]
- [[ADR-007-Skills-Architecture|Architecture des Skills]]
- [[Micro-Conversation-Delestage|Module Micro Conversation]]
- Code : `server/src/agent/utils/architectureDesignIntentGuards.js`
