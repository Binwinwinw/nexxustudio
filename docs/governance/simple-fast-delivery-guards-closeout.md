# Closeout — SIMPLE_FAST / delivery guards

Trace opérationnelle de reprise. Pas une décision, pas un plan de refactor, pas une spec produit.

Snapshot 2026-09-26. Branche `wip/checkpoint-20260824-0117`. Index vide après les commits. Aucun push, aucune PR.

Les trois commits ci-dessous sont **clos**. Ne pas les rouvrir. Ne pas les réinterpréter.

```text
14a49be  feat(agent): sanitize unverified capability claims on buffered_final
e928c53  feat(agent): sanitize SIMPLE_FAST internal contract verbalization
b7b91e9  feat(agent): block SIMPLE_FAST generic refusal on explicit deliverable
```

Worktree volontairement non propre. Les autres fichiers dirty ou untracked ne sont pas attribués à ces lots.

---

## 1. `14a49be` — claims de capacité non vérifiés

```text
Lot :     PATCH-TERMINAL-UNVERIFIED-CAPABILITY-CLAIM-GUARD-V1
Verdict : PATCH CLOS ET VÉRIFIÉ
Parent :  eb212d7
```

Détail déjà consigné : [`terminal-unverified-capability-claim-guard-closeout.md`](terminal-unverified-capability-claim-guard-closeout.md).

**Objet.** Sanitization des claims opérationnels non vérifiés avant delivery.

**Portée.** `BUFFERED_FINAL` uniquement, dans `_finalizePipelineTurn`.

**Cas.** URL documentaire fictive ; commande `npm` fictive ; audit / rapport fictif ; mémoire ou historique fictifs ; capacité opérationnelle présentée comme disponible sans preuve.

**Limite.** `already_streamed` et streaming hors couverture. Le guard ne retire pas un texte déjà émis.

---

## 2. `e928c53` — verbalisation de contrat interne

```text
Lot :     PATCH-SIMPLE-FAST-INTERNAL-CONTRACT-VERBALIZATION-GUARD-V1
          + PATCH-SIMPLE-FAST-CONTEXTUAL-CONTRACT-VERBALIZATION-GUARD-V1
Verdict : PATCHES CLOS ET VÉRIFIÉS
Parent :  14a49be
Hash :    e928c531bda7e346b839021613800cca947e16b5
```

**Cause.** Le modèle pouvait paraphraser une règle interne (tutoiement, vouvoiement, longueur, style) dans la réponse visible SIMPLE_FAST.

**Correction.** Guard combinatoire local dans `enforceModeContract`, avant le slice à deux phrases. Premier passage Vault sans query : préservation contextuelle, pas de sanitization abusive.

**Preuve.**

```text
node --test --test-force-exit --test-timeout=15000 \
tests/internal-contract-verbalization-guard.test.js
```

15 pass, 0 fail (lot interne ; la suite a ensuite été étendue pour le passage contextuel).

**Limites.**

- `history` non transmise au second passage SIMPLE_FAST ;
- `analytical_critique` sans query ;
- paraphrases hors combinaison ;
- le prompt peut encore générer la fuite ;
- streaming / Composer hors couverture.

---

## 3. `b7b91e9` — refus piste sur livrable explicite

```text
Lot :     PATCH-SIMPLE-FAST-EXPLICIT-DELIVERABLE-REFUSAL-BLOCK-V1
          + PATCH-SIMPLE-FAST-EXPLICIT-DELIVERABLE-REFUSAL-TRACE-COMMENT-V1
Verdict : PATCH CLOS ET VÉRIFIÉ ; réserve documentaire levée
Parent :  e928c53
Hash :    b7b91e9caf39e38b6074969ab296fdc6d1334c4b
```

**Incident.** « je veux faire des fiches à propos de l'utilisation du logiciel Hermes Agent » recevait le refus générique « Je vois la piste, mais pas encore la destination… ».

**Cause.** `allowRefusal=true` : les anchors voix ne reconnaissaient pas simultanément action + livrable + sujet.

**Correction.** Combo strict A ∧ B ∧ C :

- A : verbe d’action de production existant (`hasDeliverableActionVerb`) ;
- B : livrable documentaire / pédagogique nommé (formats existants, ou `fiches` / `documentation`, sans format global « fiches ») ;
- C : sujet exploitable après linker (`à propos de` / `sur` / `concernant`), hors formulations vides ou génériques.

`hasExplicitDeliverableAndSubject` → `shouldBlockGenericInsufficientRefusal` → `allowRefusal=false`. Le recovery refuse de réutiliser `INSUFFICIENT_SIGNAL_REFUSAL` depuis `rawResponse`. Le fallback incident démontré est `buildInformationRecoveryMessage` : texte final non vide, distinct du piste.

**Trace accents.** `normalizeFamiliarityQuery` → `sanitizeQuery` (minuscule, NFD, retrait des diacritiques) → matching des linkers sur la forme normalisée. Exemple : « à propos de » → « a propos de ». Le pattern doit contenir cette forme. Le commentaire V1 le dit ; il ne prétend pas que `sanitizeQuery` suffit seul.

**Preuves.**

```text
node --test --test-force-exit --test-timeout=15000 \
tests/voice-continuity-v1.test.js
```

21 pass, 0 fail.

```text
node --test --test-force-exit --test-timeout=15000 \
tests/generic-greeting-guards.test.js
```

9 pass, 0 fail.

`git show --check` vert sur `b7b91e9`.

**Limites — hors lot, pas des bugs du commit.**

- aucun plan de fiches généré ;
- JUST `general` / `explain` reste shadow ;
- `clarify=no` reste observatoire ;
- `word_guard` < 15 mots inchangé ;
- « je veux faire des fiches » sans sujet : combo inactif par intention V1 ;
- règle générale de `recoverVisibleFromFullResponse` hors audit (seuil / critère d’acceptation si longueur > 80 et caractères français accentués — pas une troncature ni un slice) ;
- `concernant` sans test dédié ;
- A′ / A″ sans pipeline jusqu’au texte final ;
- prompt, streaming, `already_streamed` et Composer hors couverture.

---

## 4. Reprise

Ne pas enchaîner automatiquement. Relire cette note, relever l’état Git, puis **un seul** GO de reconnaissance, seulement si le but correspond :

| Axe | Quand seulement |
|---|---|
| `RECON-PLAN-DE-FICHES-EXPLICITE-V1` | produire réellement un sommaire ou des fiches Hermes Agent |
| `RECON-CLARIFY-NO-CONTRACT-AUTHORITY-V1` | faire de `clarify=no` une décision appliquée, plus un observatoire |
| `RECON-RECOVER-VISIBLE-ACCEPTANCE-THRESHOLD-V1` | un incident concret justifie l’audit global du seuil d’acceptation dans `recoverVisibleFromFullResponse` |
| `RECON-STREAMED-OUTPUT-PRE-EMISSION-GUARD-OPTIONS-V1` | un incident réellement streamé avant finalisation |

Reconnaissance d’abord. Pas de patch JUST, prompt, streaming, Composer ou plan de fiches sans GO distinct.
