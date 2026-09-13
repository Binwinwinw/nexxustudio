# Régressions conversationnelles

Batterie permanente des lots Pack 1 / 2 / 3 + identité interne.

Preuve runtime : `server/tests/conversational-regressions.test.js`  
Gate : `cd server && npm run premerge` (étape `test:conversational-regressions`, **avant** le gate skills).

Commande ciblée : `cd server && npm run test:conversational-regressions`

Ne pas recopier le canon input ici. Comportement : [`docs/governance/citadelle-input-invariants.md`](governance/citadelle-input-invariants.md).

---

## Pack 1 — continuité après ouverture

- **Commit** : `0f1c2f4` `fix(subject-angle): honor continuity after guided opening, widen allowed angles`
- **Scénario** : après `subject_angle_explore` (python / deepseek harness), T+1 choisit un angle (`syntaxe`, `architecture`) ou bascule (`excel`, hors-sujet, Citadelle).
- **Erreur** : T+1 traité comme une requête neuve, ou collé au sujet ouvert, ou refus « piste / destination ».
- **Correction** : honorer la continuité d’angle ; élargir les angles admis ; Excel / hors-sujet / Citadelle = bascule, pas 2e ouverture ni méta.
- **Cas dans la batterie** : python + syntaxe ; harness + architecture ; excel après python ; hors sujet ; C'est quoi la Citadelle ?

---

## Pack 2 — meta-feedback vs reprise

- **Commit** : `80a28bc` `fix(meta-feedback): distinguish confirmation/reprise from explicit correction`
- **Scénario** : reprise copulative (« donc Nexxus c'est l'assistant ») vs confirmation (« d'accord ») vs plainte (« ta réponse était hors sujet »).
- **Erreur** : token `l'assistant` / `l agent` classé méta → feedback au lieu d’alignement.
- **Correction** : `META_FEEDBACK_MARKERS` sans token de rôle seul. Plainte = `ta réponse` / hors sujet / ne maîtrise.
- **Cas dans la batterie** : d'accord ; donc Nexxus c'est l'assistant ; ta réponse était hors sujet ; C'est quoi la Citadelle ?

---

## Pack 3 — sonde sociale vs refus épistémique

- **Commit** : `ae6643b` `fix(sonde-sociale): avoid premature epistemic refusal on tu connais X`
- **Scénario** : « deepseek harness, tu connais » (NP nommé + sonde) vs « tu connais ? » vide vs explication harness vs méta.
- **Erreur** : refus épistémique long, ou fiche peer-assistant DeepSeek, ou ouverture d’angle prématurée.
- **Correction** : sonde inversée avec NP → réponse courte + option recherche. « tu connais ? » sans NP → clarification. Peer product = le sujet **est** le produit.
- **Cas dans la batterie** : deepseek harness, tu connais ; tu connais ? ; explique le fonctionnement du harness ; ta réponse était hors sujet.

---

## Identité interne — gate référents

- **Commit** : `4934ce1` `fix(identity): answer internal identity questions directly from referents`
- **Scénario** : « comment t'appelles tu ?? », nom de la plateforme d’opération, « c'est quoi » Nexxus / Citadelle / Nexxus Studio, « qui es-tu ? ».
- **Erreur** : `turnComprehension.workPresent` bloque le rail social → `simple_factual_lookup` / `simple_fast` → « piste / destination ». Plateforme sans nom propre non matchée.
- **Correction** : `resolveUnnamedInternalIdentityHit` avant G46 et les rails factuels. Nexxus = assistant ; La Citadelle = plateforme ; Nexxus Studio = studio / dépôt. Pas de web.
- **Cas dans la batterie** : comment t'appelles tu ?? ; comment s'appelle la plateforme sur laquelle tu opères ; c'est quoi la Citadelle / Nexxus / Nexxus Studio ? ; qui es-tu ?

---

## Pack 4 — ce harness

- **Lot** : `FIX-CONVERSATIONAL-REGRESSIONS-HARNESS`
- **Rôle** : figer les quatre lots ci-dessus dans premerge. Aucun changement de routing.
