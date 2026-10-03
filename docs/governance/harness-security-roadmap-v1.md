# HARNESS-SECURITY-ROADMAP-V1

**Lot** : cadrage. Runtime non modifié par ce document.  
**Dépend de** : `AUDIT-HARNESS-INTEGRATION-SECURITY-V1` (classification C).  
**Commit** : ne pas fusionner ce fichier avec le correctif radar. Option A = rester dirty ; option B = commit documentaire distinct `docs(governance): record harness security roadmap`.

Nature : registre de findings + séquence. Pas un orchestrateur. Pas un wiring.

---

## Classification retenue

```text
harness partiel
agent unique avec experts/jobs adjacents
SovereignOrchestrator sur le path LLM
primitives de sécurité dispersées et inégalement branchées
```

Garde-fous réels : `queryGuard`, `injectionRadar`, `retrievalGuard`, `privilegedActionGate`, `FileSafety`, `enforceModeContract`, `toolGuard`, short-circuits déterministes.

Problème : dispersion, couverture inégale, trous entre frontières. Pas l’absence totale de sécurité.

---

## Registre de findings

### CONTROL_HARNESS_RUNTIME_CONTRADICTION

**Statut** : CONFIRMED  
**Corriger dans ce cadrage** : non.

`controlHarness` est utilisé en production pour `buildEmergencyReply` (`agentPipeline.js` recoverVisibleResponse).  
`validateResponse` n’est pas sur le chemin de réponse utilisateur. Call sites hors prod : `server/scripts/test_orchestrator_audit.js`, `server/tests/golden-prompts/quality-instrumentation.test.js`.  
Le fallback `emergencyReplyRegistry` (via `buildEmergencyReply`) ne passe pas dans le validateur du même module.

Ne pas brancher `validateResponse` ici. Lot prévu : `AUDIT-OUTPUT-VALIDATION-RUNTIME-CONTRACT-V1`.

### SECURITYSTAGE_QUERYRISK_LEVEL_DENY_MISMATCH

**Statut** : CONFIRMED (`DIAG-SECURITYSTAGE-QUERYRISK-CONTRACT`)  
**Corriger dans le Lot 1 radar** : non.

Taxonomie : `level` = nombre 0–4, `label` = `'SAFE'|'SENSITIVE'|'SUSPICIOUS'|'CRITICAL'|'DENY'`.  
Producteur unique du stage : `queryGuard.classify` → spread `RISK_LEVELS.*`.  
`SecurityStage` teste `queryRisk.level === 'DENY'` → toujours faux (`4 === 'DENY'`).  
Branche early-return **morte**. Radar `block` stoppe quand même via le second `scan`. Keyword DENY sans radar block (`jailbreak`, `ignore instructions`) **ne stoppe pas** avant Context. Hors diff radar.

---

## Priorités

**P0 — défauts locaux prouvés**

- regex `g` stateful dans `injectionRadar` + `.test()` sans reset `lastIndex`
- double scan `queryGuard.classify` puis `SecurityStage.run`
- trafic SC quittant avant `SecurityStage`
- contenu non fiable réinjecté (tool output / history)
- expert absent de `toolGuard`, allowlist trop large

**P0/P1 — frontières indirectes (concevoir avant wiring)**

- web/URL
- fichiers uploadés
- fichiers workspace lus
- tool output
- RAG/retrieval
- job output

**P1 — validation / fallback**

- `validateResponse` non branchée en prod
- fallback emergency hors validation
- log RAW de réponse (`validateResponse` L103–105)

**P2 — état et lifecycle**

- `validateLint('.')` clear global
- record execution après write interne échoué
- history non bornée
- GC basé sur `createdAt`
- stop process-global sticky
- timer non `unref`

---

## Séquence

Ne pas ouvrir de grand lot « harness ». Chaque lot exige un GO séparé.

```text
1. FIX-INJECTION-RADAR-STATEFUL-REGEX-V1
2. SPEC-UNTRUSTED-CONTENT-BOUNDARIES-V1
3. AUDIT-OUTPUT-VALIDATION-RUNTIME-CONTRACT-V1
4. SPEC-EMERGENCY-STOP-AND-TOOL-AUTHORITY-V1
```

Lot 1 : **clos** `d94ef16044e040efad0f6f52b00db43d2800cd90`, à la clôture du 2026-09-19, sans push ni PR.  
Lots 2–4 : **GO non accordé**. Ne pas ouvrir, ne pas fusionner au radar.

---

## Principes lots 2–4 (non implémentés)

**Canaux indirects** — avant wiring, par canal : source, confiance, forme de scan, warn/block, isolation prompt, fallback, télémétrie, rétention, tests.  
Ne jamais traiter tool output, web ou document RAG comme instruction système par défaut.

**Validation de sortie** — avant wiring `validateResponse` : contrat de retour homogène, règles actives, priorité, fallback, logs redacted, faux positifs, test du chemin production réel.

**Stop et autorité outil** — avant wiring : scope session/workspace/tenant, identité autorisée, provenance d’expert, concurrence, lifecycle, audit, reset, PAUSE/KILL.

---

## Lot 1 — statut

**ID** : `FIX-INJECTION-RADAR-STATEFUL-REGEX-V1`  
**Statut** : **CLOS** — `d94ef16044e040efad0f6f52b00db43d2800cd90` sur `wip/checkpoint-20260824-0117`. À la clôture du 2026-09-19 : sans push, sans PR, sans amend. Ce commit a ensuite été publié dans `origin/wip/checkpoint-20260824-0117` le 2026-10-02. Aucune PR vers `origin/main`.

Fichiers commités :

- `server/src/agent/harness/injectionRadar.js` (`/gi` → `/i`)
- `server/tests/injection-radar.test.js`

Preuves : radar 10/10 ; sécurité/orchestrateur 5/5 ; conversationnel 47/47. Double scan conservé, désormais stable.

**Hors Lot 1** : `SECURITYSTAGE_QUERYRISK_LEVEL_DENY_MISMATCH` (GO séparé avant toute modif de `SecurityStage.js`), déduplication de scan, SC, `queryGuard` `/g`, lots 2–4.

Ce registre reste hors du commit radar (option A dirty / B commit docs distinct).

---

## Invariants de ce cadrage

- aucun runtime modifié ici
- aucun orchestrateur nouveau
- aucun push / PR / commit
- lots phatiques, raw/comprehension/execution, consume shadow, Pack 6, Pack 8 : inchangés
- arbre sale indépendant : non mélangé
