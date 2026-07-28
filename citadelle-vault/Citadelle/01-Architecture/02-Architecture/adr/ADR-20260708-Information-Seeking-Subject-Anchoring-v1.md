# ADR-20260708 : Information Seeking Subject Anchoring (G17)

## Statut

**Accepté** (08/07/2026)

## Contexte

Sur `information_seeking_full_pipeline`, le routage P2 est sain mais la surface peut « bien parler » sans nommer l'entité demandée.

Cas canonique : « quelles informations aurais tu du jeu kingofavalon » → smalltalk ou recovery sans `kingofavalon`.

| Couche | État |
|--------|------|
| P2 | ✅ `information_seeking`, `answer_direct` |
| P3 | ❌ pas de profil transversal |

`isGeneralKnowledgeContractViolation` existait dans `finalRendererAgent.js` uniquement.

## Décision

### 1. Extraction transversale

- `conversationSubjectExtraction.js` — `extractConversationSubject()`, `surfaceMentionsSubject()`
- Signal principal (token ≥ 4 car.), pas vérité absolue — tolère variantes proches

### 2. Profil P3 `information_seeking`

- `informationSeekingQualificationPolicy.js`
- Signaux : `subject_anchor_miss`, `information_seeking_recovery`, refus, pseudo-clarify, social drift
- Réutilise `isGeneralKnowledgeContractViolation` pour `general_knowledge_*`
- Enforcement : `enforceInformationSeekingDirectness()` — fallback ancré sur cible

### 3. Shadow P4

- `contract_violation_information_seeking_directness`
- `information_seeking_shadow_stats`

## Conséquences

- Pas de regex par entité métier (kingofavalon = cas test canonique)
- Alignement GK + information_seeking sous un profil P3 unifié

## Fichiers

| Fichier | Rôle |
|---------|------|
| `conversationSubjectExtraction.js` | Extraction sujet |
| `informationSeekingQualificationPolicy.js` | Détection + enforcement |
| `conversationMoveContractVerification.js` | Profil P3 |
| `conversationMoveShadowTelemetry.js` | Métrique shadow |

## Références

- [Conversation Move Governance](../../../docs/agents/conversation-move-governance.md) — § G17
