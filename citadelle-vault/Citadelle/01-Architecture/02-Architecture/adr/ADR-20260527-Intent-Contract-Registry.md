# ADR-20260527 : Intent Contract Registry

## Statut
**Validé** (27/05/2026)

## Contexte

La Citadelle dispose déjà de contrats de réponse (`modeResponseContracts.js`), d'une matrice d'orchestration (`EXPERT_MATRIX` dans `SovereignOrchestrator.js`) et de garde-fous ad hoc (`conversationGuards.js`, bypass SIMPLE_FAST pour idéation).

Cette dispersion a produit une régression documentée : une requête d'idéation courte (< 15 mots) passait en **SIMPLE_FAST** avant d'atteindre le contrat **OPEN_PROPOSITION**, déclenchant un refus « signal insuffisant » alors que l'intention utilisateur était claire.

Une analyse comparative avec Ruflo confirme que le gain le plus rentable pour La Citadelle n'est pas la multiplication d'agents, mais la **formalisation contractuelle du routage par intention** — tout en préservant la doctrine lazy-loading (1–2 experts max, voix publique unique, local-first).

## Décision

Introduire un **Intent Contract Registry** : registre versionné, source unique de vérité pour la chaîne :

```
Requête → contrat d'intention → routage (stages, bypass) → mode de réponse → validation → observabilité
```

### Structure d'un contrat

Chaque entrée du registre définit :

| Champ | Rôle |
|-------|------|
| `id` | Identifiant stable (`IDEATION_OPEN`, `FACTUAL_RESEARCH`, …) |
| `orchestratorIntents` | Intents compatibles avec `EXPERT_MATRIX` |
| `responseMode` | Mode `modeResponseContracts` (`OPEN_PROPOSITION`, `DOCUMENT`, …) |
| `routing` | `bypassSimpleFast`, `skipWebSearch`, `maxActiveExperts`, `orchestratorMode` |
| `detection` | Garde de détection amont (ex: `isOpenProjectIdeation`) |
| `observability` | Tags logs, préfixe fallback, incident health |
| `smoke` | Requête échantillon + assertions de non-régression |

Schéma JSON : `server/src/agent/contracts/intentContractRegistry.schema.json`  
Implémentation runtime : `server/src/agent/config/intentContractRegistry.js`

### Contrats v1 (initial)

| ID | Mode réponse | Bypass SIMPLE_FAST | Skip web |
|----|--------------|-------------------|----------|
| `IDEATION_OPEN` | OPEN_PROPOSITION | oui | oui |
| `ARCHITECTURE_OPTIONS` | OPEN_PROPOSITION | oui | oui |
| `FACTUAL_RESEARCH` | DOCUMENT | oui | non |
| `DIAGNOSTIC` | CRITICAL | oui | non |
| `SOCIAL` | SIMPLE_FAST | non | oui |
| `INSTANT` | INSTANT | oui | oui |
| `CONVERSATION_STANDARD` | COMPOSER | non | non |

### Résolution

Ordre de priorité (`resolveIntentContract`) :

1. Override explicite `packet.meta.intent_contract_id`
2. Garde de détection (priorité numérique décroissante)
3. `packet.user_intent` ↔ `orchestratorIntents`
4. Fallback `CONVERSATION_STANDARD`

### Doctrine préservée

- **Max 2 experts actifs** — inchangé
- **Une voix publique** (`finalRendererAgent`) — inchangé
- **Pas de swarm parallèle** — hors scope
- **Fail-closed épistémique** — maintenu sur CRITICAL/DOCUMENT ; assoupli uniquement sur OPEN_PROPOSITION (l'intention suffit comme signal)

## Conséquences

### Positives

- Routage intent → contrat **explicite et testable**
- Smoke tests contractuels par intent (`intent-contract-registry.test.js`)
- Réduction des régressions de type « bon contrat, mauvais chemin pipeline »
- Base extensible pour hooks transverses et ADR ↔ code ↔ test

### Négatives / Compromis

- Double source transitoire : registry + logique legacy dans `modeResponseContracts.js` jusqu'à migration complète
- Risque de conflit si deux gardes matchent — mitigé par `priority`

## Plan de migration (par fichiers)

| Phase | Fichier | Action |
|-------|---------|--------|
| **v1.0** ✅ | `intentContractRegistry.js` | Registre + résolution |
| **v1.0** ✅ | `intent-contract-registry.test.js` | Smoke par intent |
| **v1.0** ✅ | `agentPipeline.js` | `shouldBypassSimpleFast()` depuis registry |
| **v1.1** ✅ | `SovereignOrchestrator.js` | `applyIntentContractToPacket()`, `shouldSkipWebSearchForIntent()`, `packet.meta.intent_contract_id` |
| **v1.1** ✅ | `finalRendererAgent.js` | `getComposerObservabilityContext()`, logs `contract/mode/path=primary|fallback` |
| **v1.2** | `modeResponseContracts.js` | Déplacer prompts/validation par contrat ; registry = seule entrée |
| **v1.3** | `package.json` | Inclure `intent-contract-registry.test.js` dans `test:stability` |

## Validation

```bash
cd server && node --test tests/intent-contract-registry.test.js
cd server && npm run test:stability
```

Requête terrain idéation :

> J'ai envie de construire quelque chose en IA, mais je ne sais pas quoi

Attendu : contrat `IDEATION_OPEN`, log `openProposition=primary`, 3 pistes + « Laquelle t'intéresse ? »

## Liens

- [[ADR-011-DISCIPLINE-EPISTEMIQUE|Discipline épistémique]]
- [[ADR-015-Routage-Generator-First|Routage Generator-First]]
- [[ADR-007-Skills-Architecture|Architecture des Skills]]
- [[ADR-20260601-Architecture-Design-Options|Doctrine « comment créer X »]]
- Module : `server/src/agent/config/intentContractRegistry.js`
