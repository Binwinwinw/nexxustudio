# Pré-émission — cohérence job / fuite interne

| Champ | Valeur |
|-------|--------|
| **Nature** | Cadrage. Pas un lot ouvert. Pas de runtime. |
| **Date** | 2026-09-07 |
| **Cas** | Fil live : phatique → phpMyAdmin définition (fuite COMPOSER) → how-to phpMyAdmin OK → n8n « comment ça marche » piste → n8n mails named_create print/PDF |
| **Lots clos** | Autorité 1–5, C4.1–C4.2. Ne pas rouvrir. |
| **Canon** | [`citadelle-input-invariants.md`](../governance/citadelle-input-invariants.md) — pas de 2e NLU, JUST shadow |

Ce n’est pas un modèle trop petit. Le tour how-to phpMyAdmin (`how_to_simple_local`) le prouve : **bon rail = bonne reply**, sans LLM.

---

## 1. Deux familles, pas une

### Famille A — échec de job

Demande réelle = procédure / compréhension d’outil / aide concrète.  
Reply émise = autre acte (cadrage livrable, refus piste, overview, small-talk approfondi).

| Tour | Demande | Job attendu | Rail émis | Acte émis |
|------|---------|-------------|-----------|-----------|
| n8n « comment ça fonctionne » | comprendre l’outil | `direct` / `overview` | `simple_fast` | refus piste |
| n8n + mails + inscriptions | procédure d’automatisation | `direct` | `named_create_start` | format print / HTML / PDF |
| (historique C4) phpMyAdmin + « application web » | procédure | `direct` | `web_project_scoping_*` | cadrage site |

C4.2 bloque déjà les rails **typés** (`*_scoping` / `*_clarify` / `*overview*`) dans `emit()`.  
`named_create_start`, `simple_fast`, `social_deterministic` : **non typés**, hors gate.

### Famille B — échec de contexte

Texte interne visible : instructions, méta anglais, brief réécrit, raisonnement.

Cas live : « est-ce que tu sais ce que phpmyadmin ? »

- JUST : `explain` (shadow).
- Rail : `general_knowledge_continuity_carryover`.
- Brief modèle (exact) : `Approfondis Tu Fais de Beau : complète ta réponse précédente…` (`buildContinuityKnowledgeQuery`).
- Exécution : Sovereign + `CODE_INTENT` + `COMPOSER`, 252 chunks streamés.
- Sortie : dump anglais (`Analyze the Request`, `EXECUTION_BRIEF`, `NO English meta-commentary`).

La fuite n’est pas « le modèle réfléchit trop ». C’est **un brief empoisonné** + **des marqueurs de leak trop étroits** + **un stream avant la garde**.

`containsInternalPromptLeak` ne connaît que des marqueurs FR (`[MODIFICATEUR]`, `contrat de sortie`, …). Le dump anglais **passe**.  
La garde vit dans `_finalizePipelineTurn`, **après** les chunks déjà envoyés.

---

## 2. Chaîne réelle vs chaîne manquante

```
compréhension (cycle)     — existe
    ↓
responseType (C4.1)       — existe, visible
    ↓
choix du rail (SC / move / SIMPLE_FAST / named_create / continuity)
    ↓  ← trou A : rails non typés ignorent le job
émission emit() / stream
    ↓  ← trou B : leak check trop tard et trop étroit
utilisateur
```

| Étape | Où | Manque |
|-------|-----|--------|
| 1. Comprendre | `understandQuery` + workup | Pas le sujet de ce cadrage. Ne pas retoucher l’input utilisateur. |
| 2. Job | `response_commitment.responseType` | OK. Ne pas élargir l’enum. |
| 3. Rail | SC, move, INSTANT, named_create, continuity, SIMPLE_FAST | Pattern = décision si rail non typé. Continuité **réécrit** la query modèle. |
| 4. Valider avant envoi | partiel : C4.2 `emit()`, leak en finalize | Pas une garde unique. Stream COMPOSER contourne. |
| 5. Bouche | composer / template | Ne doit pas requalifier. Doit **pouvoir être stoppée**. |

« Réflexion légère » ici = **validation déterministe pré-émission**, pas un 2e LLM, pas un CoT visible.

---

## 3. Mécanisme proposé (un paquet, deux appels)

Pas de nouveau packet cycle. Pas de consume JUST. Pas de refactor SC.

**Fonction unique** (nom de travail) : `assertPreEmitCoherence({ path, text, responseType, query })`

Retourne `{ ok, reason, text }` (texte de remplacement seulement si leak / sortie interdite).

### 3.1 Contrôle job ↔ rail

Étendre le mapping déjà là (`inferShortCircuitPathResponseType`) **sans changer C4.2** :

| Path | Job implicite |
|------|----------------|
| `*scoping*` | `scoping` (déjà) |
| `*_clarify` | `clarify` (déjà) |
| `*overview*` | `overview` (déjà) |
| `named_create_start` | livrable print/PDF → **incompatible** avec how-to / outil nommé (`n8n`, `phpMyAdmin`) si `responseType === "direct"` |
| `simple_fast` + texte = piste | **incompatible** si la query a déjà un sujet nommé |

Sans `responseType` : ne pas bloquer (même contrat que C4.2).

### 3.2 Contrôle sortie interdite

Sur `text`, déterministe :

- refus piste (`INSUFFICIENT_SIGNAL_REFUSAL`) alors que la query nomme un outil / un but ;
- gabarit « print, HTML ou PDF » alors que la query n’est pas un livrable de présentation.

Pas de NLU neuf : réutiliser ancres / shells déjà là (`isHowToRequestShell`, spans, noms d’outils du how-to local).

### 3.3 Garde anti-leak

Étendre `INTERNAL_LEAK_HIGH` avec les formes **déjà vues** :

- `Analyze the Request`
- `EXECUTION_BRIEF`
- `System Instruction`
- `NO English meta-commentary`
- `redacted_thinking` / dump de contraintes

Appeler **avant le premier `onContent`**, pas seulement en fin de tour.  
Pour `COMPOSER` / `simple_fast` LLM : rester en **buffer** jusqu’au check (mode livraison déjà existant `BUFFERED_FINAL`). Ne pas streamer un texte qui match.

### 3.4 Continuité (cause du brief empoisonné)

Ne pas parser l’utilisateur autrement. **Ne pas** lancer `general_knowledge_continuity_carryover` si `assessCurrentTurnEntityPivot` est déjà `detected` (phpMyAdmin ≠ « tu fais de beau »). Pivot déjà calculé ailleurs. Un `if` sur le carryover.

Hors fonction `assertPreEmitCoherence`. Lot voisin, plus petit encore.

---

## 4. Lots éventuels (GO explicite, un à la fois)

| Id | Objectif | Périmètre | Preuve |
|----|----------|-----------|--------|
| `PRE_EMIT_LEAK_V1` | Fuite interne jamais visible | marqueurs leak + buffer avant stream COMPOSER/SIMPLE_FAST | dump anglais live → fallback, 0 chunk leak |
| `PRE_EMIT_JOB_RAIL_V1` | Rails non typés respectent `responseType` | mapping `named_create_start` / piste `simple_fast` + appel finalize (et emit si path SC) | n8n mails ↛ print/PDF ; n8n « comment ça marche » ↛ piste |
| `CONTINUITY_PIVOT_SKIPS_CARRYOVER_V1` | Brief non réécrit sur sujet neuf | carryover + `assessCurrentTurnEntityPivot` | phpMyAdmin définition ↛ `Approfondis Tu Fais de Beau` |

Ordre : leak d’abord (gravité utilisateur), puis job↔rail, puis continuité.

---

## 5. Hors périmètre

- Rouvrir lots 1–5 / C4.1–C4.2.
- Consume JUST.
- 2e NLU, nouveau `responseType`, refonte SC, changement de personnalité.
- Faire « réfléchir » le composer. La bouche reste la bouche.

---

## 6. Ouverture

Cadrage seulement. Runtime = GO sur **un** id de §4.
