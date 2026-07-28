# ADR-20260722 : Posture, contrat de sortie, épistémique transverse & SessionModeState v1

## Statut

**Accepté partiel** (22/07/2026) — P0 câblé : `SessionModeState` + `PosturePolicy` (sticky/TTL/switch/override + télémétrie). DeliverableContract / Epistemic mère / rails mentor-advisor : backlog.

## Contexte

La Citadelle dispose déjà d’un tissu dense de **rails** (short-circuits), **guards** et **policies** (social G35–G46, code/forge, knowledge/web, docs, math, épistémique locale `epistemicUncertaintyResolutionPolicy`).

Le diagnostic de polyvalence (juillet 2026) :

1. Le manque n’est **pas** « plus de regex » ni une explosion de chemins.
2. Le manque est un **type de relation** explicite (posture) + un **contrat de valeur promise** + une **autorité** claire entre couches.
3. L’épistémique existe mais n’est pas encore élevée au rang de **policy mère** transverse à mentor / advisor / executor / architecte.
4. Des fils cassés (mauvais couloir) et des oscillations de style montrent le besoin de **sticky modes** et d’un pack **conversation_repair**.

### Vocabulaire (distinction obligatoire)

| Terme | Définition Citadelle |
|-------|----------------------|
| **Policy** | Règle transverse de décision (entrée, droits, sorties autorisées) — pas un path |
| **Shell** | Cadre d’entrée/sortie pour une famille de tours (ex. transform de contenu existant) |
| **Domaine** | Registre sémantique du sujet (tech, spatial_3d, culinary…) — **ne route jamais seul** |
| **Rail / path** | Couloir d’exécution (`pipelinePath`, short-circuit) |
| **Posture** | Relation Nexxus↔utilisateur (mentor, advisor, executor…) |
| **Contrat de sortie** | Forme de valeur promise (conseil, plan, patch, atelier…) |

## Décision

Introduire **quatre briques transverses** au-dessus / à côté de ConversationMove et JUST, sans remplacer les rails existants.

### Doctrine

> **La posture fixe la relation. Le contrat fixe la valeur promise. L’épistémique fixe le droit d’affirmer. Le rail exécute. Le LLM rédige sous contrat.**

Règle centrale (épistémique) :

> Nexxus ne prétend jamais savoir ce qu’il ne sait pas ; il essaie d’inférer, puis de clarifier, puis de vérifier, et seulement ensuite de répondre.

### Brique 1 — `PosturePolicy`

Postures v1 :

| Posture | Initiative | Droit question | Droit exécution | Style |
|---------|------------|----------------|-----------------|-------|
| `conversational` | basse | oui | non | papoter, continuité |
| `mentor` | moyenne | **forte** (socratique) | non (sauf exercice guidé) | peu de dump, pousse le raisonnement |
| `advisor` | moyenne | ciblée | non | options → arbitrages → reco → risques |
| `executor` | haute | minimale | **oui** (sous mandat) | patch / livrable / action |
| `formatter` | basse | si ambiguïté de cible | transform seulement | reformate un contenu existant |
| `architect` | moyenne | oui | non (atelier) | arbitrage itératif, pas 3 options one-shot |

**Sticky** : `SessionModeState.posture` persiste **5–10 tours** ou jusqu’à rupture forte d’intention (voir autorités).

**Entrées** : explicite (« reste en mode mentor ») ou inférée (signaux pédagogiques / « fais-le pour moi » / « reformate ça »).

### Brique 2 — `DeliverableContractPolicy` (sortie promise)

Pas un « formatter fourre-tout ». Deux objets distincts :

1. **Valeur promise** (`promisedValue`) — une par tour :
   - `advice` | `plan` | `patch` | `explanation` | `workshop` | `execution` | `transform` | `scoping` | `clarify` | `refusal`
   - Exploration / social (≠ clarify livrable) : `social_continuity` | `exploration_proposal` | `guided_choice` — voir mini-spec §2.3.1 de la spec opérationnelle
2. **Shell formatter** = uniquement `promisedValue === transform` sur un **contenu source** (message / fichier / bloc collé), avec **cible** contrainte :
   - `email` | `markdown` | `json` | `slides_outline` | `formal_doc` | `report` — jamais un rail de production concurrent de forge/code.

Champs contrat :

```javascript
{
  contract: "DELIVERABLE_CONTRACT_V1",
  promisedValue: string,
  structureHint: string | null,   // ex. "options+reco+risques"
  evidenceLevel: "none" | "local" | "web" | "file",
  mayAct: boolean,                // write disk / forge / tools
  verifyBeforeDeliver: boolean
}
```

### Brique 3 — `EpistemicResolutionPolicy` (policy mère)

Élève et unifie `epistemicUncertaintyResolutionPolicy` + `uncertaintyPolicy` :

| État | Action |
|------|--------|
| `known` | répondre |
| `inferable` | répondre avec marqueur d’hypothèse / clarification fermée si medium |
| `ambiguous` | clarification ciblée (hypothèse avant question) |
| `externally_verifiable` | vérifier (web / fichier / outil) |
| `unsafe_to_conclude` | refus propre / aveu — **interdit d’inventer** |

S’applique **à toutes les postures**. Mentor et advisor n’ont pas le droit de « parler à vide » plus que executor.

### Brique 4 — `SessionModeState`

État sticky de session / fil :

```javascript
{
  contract: "SESSION_MODE_STATE_V1",
  posture: string,
  userCalibration: {
    level: "novice" | "intermediate" | "expert",
    pace: "rushed" | "exploratory" | "blocked" | "production",
    density: "low" | "medium" | "high"
  },
  dominantPromisedValue: string | null,
  tone: string | null,
  turnsRemaining: number,        // défaut 8 ; max 10
  setAtTurnId: string | null,
  breakReasons: string[]         // télémétrie
}
```

**Calibration utilisateur** : policy transverse distincte (`UserCalibrationPolicy`) qui alimente densité / longueur / jargon — obligatoire pour mentor/advisor/architecte.

### Hiérarchie d’autorité (conflits)

Ordre **décroissant** (le premier qui tranche gagne) :

1. **Sécurité / permission / danger** (refus, pas d’exploit, sandbox)
2. **Mandat d’exécution explicite** du tour (`fais-le maintenant`, write, forge) → force `executor` + `promisedValue=execution|patch` **pour ce tour**
3. **Épistémique** (`unsafe_to_conclude` / clarify) — peut bloquer toute posture
4. **Contrat de sortie du tour** (`DeliverableContract`)
5. **Posture sticky** (`SessionModeState`)
6. **ConversationMove** / famille / rail
7. **JUST / short-circuit** d’exécution
8. **LLM** (rédaction seulement)

Exemple : sticky `mentor` + « fais-le pour moi maintenant » → (2) gagne : executor pour le tour ; optionnellement proposer de revenir en mentor après livraison.

### Ce qui n’est **pas** une posture

- **3D / spatial** = **domaine** + contrats (`scene_brief`, explain shader) — jamais `posture=3d`.
- **Agent IA multi-agents** = décomposé en shells : `agent_scoping` → `agent_architecture` → `memory_tools_evals` → `forge_handoff` — pas un rail « build AI stuff ».
- **Architecte long** = posture `architect` + atelier itératif (ADR léger / trade-offs) — **ne duplique pas** `architecture_design_deterministic` (3 options one-shot), compare_choose, code review.

### Packs satellites (après les 4 briques)

| Pack | Rôle |
|------|------|
| `mentor_rail` | Short-circuit / contrat socratique sous posture mentor |
| `advisor_rail` | Options + reco + risques sous posture advisor |
| `conversation_repair` + social lock (G36) | Réparer un mauvais couloir en 1 tour ; verrou social |
| `SELF_ARCHITECTURE_AUDIT` | Expliquer honnêtement le câblage (lire registres, pas inventer) |
| architecture workshop / pair-debug / long-form / agent IA | P1 après fondations |

## Conséquences

**Positives** : polyvalence sans explosion de routes ; continuité de style ; promesse de valeur claire ; épistémique partout ; conflits tranchables.

**Négatives** : état session à persister ; calibration à calibrer (risque de mauvaise densité) ; sticky trop agressif peut frustrer — d’où `turnsRemaining` + ruptures fortes.

**Risques** : formatter mal borné → concurrence forge — mitigé par `transform` + source obligatoire.

## Hooks d’intégration (chaîne actuelle)

| Étape | Fichier(s) | Hook |
|-------|------------|------|
| Amont move | `conversationMovePolicy.js` | Lire `SessionModeState` ; annoter move avec `posture` / `promisedValue` |
| Épistémique | `epistemicUncertaintyResolutionPolicy.js` | Promouvoir en policy mère appelée **avant** clarify générique (déjà partiel) |
| Short-circuit | `intentShortCircuit.js` | `resolvePostureRail` (mentor/advisor) après épistémique ; repair pack |
| Clarification | `clarificationDecisionPolicy.js` | Respecter épistémique + calibration (moins de clarify livrable en mentor) |
| JUST | `justIntentDetectionPolicy.js` | Mapper action→`promisedValue` ; ne pas écraser posture sticky sauf autorité 2 |
| Composer / manner | `responseMannerPolicy.js`, contrats mode | Injecter densité calibration + style posture |
| Pipeline | `agentPipeline.js` | Charger/sauver `SessionModeState` sur le fil ; télémétrie posture |
| Audit self | futur `selfArchitectureAuditPolicy.js` | Lire registres path/contrat — fail-closed si inconnu |

## Backlog d’implémentation (ordre strict)

1. `SessionModeState` + persistance fil  
2. `PosturePolicy` + sticky + autorités  
3. `DeliverableContractPolicy` + `promisedValue` — **P0 observe fait** (`deliverableContractPolicy.js`, télémétrie ; enforcement backlog)  
4. Élévation `EpistemicResolutionPolicy` (mère) + calibration utilisateur  
5. Rails `mentor` + `advisor`  
6. `conversation_repair` + social lock G36  
7. Ensuite seulement : architecture workshop, pair/incident, long-form, agent IA (scopes séparés), domaines P2 (3D, data, ops)

## Références

- ADR Conversation Move : `ADR-20260707-Conversation-Move-Governance-v1.md`
- Spec move : `docs/agents/conversation-move-governance.md`
- Épistémique runtime : `server/src/agent/policies/epistemicUncertaintyResolutionPolicy.js`
- Spec opérationnelle : `docs/agents/posture-deliverable-epistemic-spec-v1.md`
- Discipline épistémique historique : `ADR-011-DISCIPLINE-EPISTEMIQUE.md`
