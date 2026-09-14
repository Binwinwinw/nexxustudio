# Régressions conversationnelles

Dernière mise à jour : 2026-09-12  
Statut : **8 lots fermés** (Packs 1–7 + identité), batterie harness verte.

**Reprise** : cette fiche est la source pour reprendre le chantier conversationnel. La règle Cursor `.cursor/rules/conversational-regressions.mdc` impose de la lire en début de session. `.memory/` ne fait que pointer ici.

Preuve runtime : `server/tests/conversational-regressions.test.js`  
Commande : `cd server && npm run test:conversational-regressions`  
Gate : `cd server && npm run premerge` (étape `test:conversational-regressions`, **avant** le gate skills).

Ne pas recopier le canon input ici. Comportement : [`docs/governance/citadelle-input-invariants.md`](governance/citadelle-input-invariants.md).

---

## Pack 1 — continuité après ouverture

- **Commit** : `0f1c2f4` `fix(subject-angle): honor continuity after guided opening, widen allowed angles`
- **Scénario** : après `subject_angle_explore` (python / deepseek harness), T+1 choisit un angle (`syntaxe`, `architecture`) ou bascule (`excel`, hors-sujet, Citadelle).
- **Erreur** : T+1 traité comme une requête neuve, ou collé au sujet ouvert, ou refus « piste / destination ».
- **Correction** : reconnaître l’angle en attente (`ANGLE_CHOICE_PENDING`) ; élargir les angles (syntaxe, performance, sécurité…) ; « oui plutôt X, renseigne-toi » garde sujet + angle.
- **Cas dans la batterie** : python + syntaxe ; harness + architecture ; excel après python ; hors sujet ; C'est quoi la Citadelle ?
- **Effet** : une réponse dans le fil n’est plus une requête neuve par défaut.

---

## Pack 2 — meta-feedback vs reprise

- **Commit** : `80a28bc` `fix(meta-feedback): distinguish confirmation/reprise from explicit correction`
- **Scénario** : reprise copulative (« donc Nexxus c'est l'assistant ») vs confirmation (« d'accord ») vs plainte (« ta réponse était hors sujet »).
- **Erreur** : token `l'assistant` / `l agent` classé méta → feedback au lieu d’alignement.
- **Correction** : `META_FEEDBACK_MARKERS` sans token de rôle seul. Plainte = `ta réponse` / hors sujet / ne maîtrise.
- **Cas dans la batterie** : d'accord ; donc Nexxus c'est l'assistant ; ta réponse était hors sujet ; C'est quoi la Citadelle ?
- **Effet** : une reprise copulative reste un alignement. Les vraies plaintes restent en méta.

---

## Pack 3 — sonde sociale vs refus épistémique

- **Commit** : `ae6643b` `fix(sonde-sociale): avoid premature epistemic refusal on tu connais X`
- **Scénario** : « deepseek harness, tu connais » (NP nommé + sonde) vs « tu connais ? » vide vs explication harness vs méta.
- **Erreur** : refus épistémique long, ou fiche peer-assistant DeepSeek, ou ouverture d’angle prématurée.
- **Correction** : sonde inversée avec NP → réponse courte + option recherche. « tu connais ? » sans NP → clarification. Peer product = le sujet **est** le produit.
- **Cas dans la batterie** : deepseek harness, tu connais ; tu connais ? ; explique le fonctionnement du harness ; ta réponse était hors sujet.
- **Effet** : « X, tu connais » nommé n’est plus un refus long ni un peer-assistant.

---

## Identité interne — gate référents

- **Commit** : `4934ce1` `fix(identity): answer internal identity questions directly from referents`
- **Scénario** : « comment t'appelles tu ?? », nom de la plateforme d’opération, « c'est quoi » Nexxus / Citadelle / Nexxus Studio, « qui es-tu ? ».
- **Erreur** : `turnComprehension.workPresent` bloque le rail social → `simple_factual_lookup` / `simple_fast` → « piste / destination ».
- **Correction** : `resolveUnnamedInternalIdentityHit` avant G46 et les rails factuels. Nom / qui-es-tu → Nexxus ; nom de la plateforme d’opération → La Citadelle. Pas de web.
- **Cas dans la batterie** : comment t'appelles tu ?? ; comment s'appelle la plateforme sur laquelle tu opères ; c'est quoi la Citadelle / Nexxus / Nexxus Studio ? ; qui es-tu ?
- **Effet** : identité interne sans nom propre → référents locaux, pas de recherche.

---

## Pack 4 — ce harness

- **Commit** : `e6731a6` `fix(regressions): add conversational tests harness and documentation`
- **Rôle** : figer Packs 1/2/3 + identité dans premerge. Aucun changement de routing à la création.
- **Effet** : tout lot suivant rejoue les cas déjà fermés. Une régression sur un lot clos = lot échoué.

---

## Pack 5 — articulations FR de validation / invalidation

- **Commit** : `6557a02` `fix(french-validation): add linguistic markers dictionary for validation/invalidation`
- **Scénario** : « si j'ai bien compris » (tête ou queue) + proposition, n’importe quel sujet.
- **Erreur** : marqueur traité comme filler / greeting ; copule simple Nexxus/Citadelle ignorée ; virgule laissée dans la proposition extraite.
- **Correction** : dictionnaire `server/src/agent/policies/conversation/linguistic_markers_fr.json` ; extraction tête/queue ; Oui / Non + contexte. Gate référents pour Nexxus/Citadelle. Liste close Python.
- **Cas dans la batterie** : Nexxus = assistant ; Citadelle = plateforme ; Python = langage ; Nexxus = plateforme (non) ; Citadelle = assistant (non).
- **Effet** : validation / invalidation française, tous sujets, pas un filler.

---

## Pack 6 — questions sociales / conversationnelles

- **Commit** : `a77e097` `fix(social-questions): answer conversational questions directly in social rail`
- **Scénario** : « qu'est ce tu racontes de beau ? », « quoi de neuf ? », « qu'y a-t-il de nouveau ? », « tu racontes quoi ? », « il y a du nouveau ? » vs check-in « salut, comment ca va ? ».
- **Erreur** : `general/explain` + `clarify_then_build` → `simple_fast` / `epistemic_verify_external` → « piste / destination » ou web.
- **Correction** : élargir `social/phatic_checkin` (`raconter`, `que` oral omis, `du nouveau`) ; pas de nouvelle classe d’intention ; sujet collé (`sur python`) reste info.
- **Cas dans la batterie** : les cinq questions sociales + salut comment ça va.
- **Effet** : small talk → rail social direct, sans recherche ni phrase passe-partout.

---

## Pack 7 — attributs identité assistant

- **Commit** : à poser — `fix(identity): route assistant attributes to deterministic identity rail`
- **Scénario** : salut+nom ; date de naissance / âge / créateur / organisation (2e personne) vs tiers (Victor Hugo, mon enfant).
- **Erreur** : panel manner « assistant de Nexxus Studio » ; `ta date de naissance` → `simple_factual_lookup` + LLM tronqué puis fallback contrat (`Pour répondre à… donnée factuelle directe`).
- **Correction** : `IDENTITY_NAME_REPLY` figée Citadelle ; `isAssistantSelfAttributeIntent` (birth_date=null, âge, org, créateur inconnu) avant lookup ; tiers `date de naissance de` exclus. Pas de nouvelle classe d’intention.
- **Cas dans la batterie** : T1–T11 (nom, naissance ×2, âge, créateur, org, né, Hugo, enfant, check-in, racontes de beau).
- **Effet** : attributs NEXXUS = identité locale, une phrase, pas de web ni de fuite de consigne.

---

## Follow-up — qui est NEXXUS (référent nommé)

- **Commit** : à poser — `fix(identity): resolve named Nexxus who-is queries`
- **Pas Pack 8.** Pack 7 (`bfea630`) reste fermé.
- **Scénario** : « qui est nexxus ?? », « qui est NEXXUS ? », « c'est qui NEXXUS ? ».
- **Erreur** : nom propre → unnamed = null ; « qui est » n’est pas un shell `c'est quoi` → `simple_factual_lookup` + fallback contrat.
- **Correction** : `isIdentityExternalIntent` + référent `Nexxus` → `INTERNAL_REFERENT_REPLIES.Nexxus` dans `resolveUnnamedInternalIdentityHit`, avant lookup. Tiers exclus.
- **Cas dans la batterie** : T1–T3 who-is ; T4/T5 Pack 7 ; Victor Hugo / cette personne.
- **Effet** : même contrat que « c'est quoi Nexxus ? ».

---

## Règle permanente

Pour tout futur lot conversationnel :

1. Ajouter les cas à `server/tests/conversational-regressions.test.js`.
2. Vérifier que `npm run premerge` les inclut (première étape).
3. Si un cas des Packs 1–7 + identité régresse, le lot est **échoué** même si ses propres tests sont verts.
4. Documenter ici : scénario, erreur, correction, cas ajoutés.

Ne pas importer `agent.js` dans cette batterie (hang Ollama). SC déterministe seulement.

---

## Notes

- Dictionnaire linguistique : `server/src/agent/policies/conversation/linguistic_markers_fr.json`
- Référents : Nexxus = assistant ; La Citadelle = plateforme ; Nexxus Studio = studio / dépôt

| Lot | Commit | Message |
|---|---|---|
| Pack 1 | `0f1c2f4` | fix(subject-angle): honor continuity after guided opening, widen allowed angles |
| Pack 2 | `80a28bc` | fix(meta-feedback): distinguish confirmation/reprise from explicit correction |
| Pack 3 | `ae6643b` | fix(sonde-sociale): avoid premature epistemic refusal on tu connais X |
| Identité | `4934ce1` | fix(identity): answer internal identity questions directly from referents |
| Pack 4 | `e6731a6` | fix(regressions): add conversational tests harness and documentation |
| Pack 5 | `6557a02` | fix(french-validation): add linguistic markers dictionary for validation/invalidation |
| Pack 6 | `a77e097` | fix(social-questions): answer conversational questions directly in social rail |
| Pack 7 | *(ce commit)* | fix(identity): route assistant attributes to deterministic identity rail |
| Follow-up who-is | à poser | fix(identity): resolve named Nexxus who-is queries |
