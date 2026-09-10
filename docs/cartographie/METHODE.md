# Cartographie — méthode

| Champ | Valeur |
|-------|--------|
| **Nature** | Règle de lecture. Pas une carte. Pas une cible. |
| **Date** | 2026-08-18 |
| **Statut** | **Actée** |

Cartographier le réel, puis décider.

Les cartes sont un **inventaire** de l’existant, pas une cible.  
Elles servent à identifier **doublons**, **trous** et **dépendances** pour optimiser la plateforme : **garder**, **consolider**, **retirer** ou **isoler** selon le coût et la valeur.

On n’écrit pas une architecture idéale. On documente l’existant pour décider dessus.

---

## Enchaînement

1. Cartographier l’existant.
2. Repérer doublons, trous et dépendances.
3. Distinguer le gardable du coûteux.
4. Proposer suppressions ou consolidations **quand c’est justifié**.
5. Ne pas confondre cartographie et prescription.

Une proposition d’optimisation n’est pas un lot de carte. Un lot de carte n’est pas un plan de refactor.

---

## Règle de travail — contrôle du rail

Simplicité = **contrôle du rail**.  
Simple → direct.  
Ambigu → clarifier.  
Complexe → réfléchir / chercher / vérifier, puis s’arrêter.  
Les cartes sont des **photos**, pas une cible.

Le trou Lune n’était pas un manque de réflexion, mais un **mauvais rail**. Le travail restant n’est pas une nouvelle philosophie : finaliser les points déjà observés.

---

## Chantiers à finaliser (uniquement s’ils sont déjà documentés)

Cadre d’un chantier : problème observé ; cause probable ; correction limitée ; test de non-régression.  
**Interdit dans un chantier :** nouveau mode, 3e doc amont, refonte globale.

**Réflexe :** périmètre minuscule ; traiter le coût visible ; lots fermés intacts ; la correction améliore le rail sans nouvel effet de bord.

| Id | Problème observé | Cause probable | Correction limitée | Test | Statut |
|----|------------------|----------------|--------------------|------|--------|
| C1 | « j'aimerais savoir pour quelle raison la lune… » → hunt web « Terre » | Shell `j'aimerais` = `information_seeking` ; cible `de la terre` | Shell causal (`pourquoi` / `pour quelle raison` / `comment se fait`) **avant** `information_seeking` | `information-seeking-intent-guards` : `j'aimerais + pour quelle raison` → `simple_factual_lookup` | **Codé** — rejouer après reload |
| C2 | Question cadrée → piste ou stub web | Refus générique / filet web trop tôt | Réponse courte (fiche / `simple_factual`) si déjà cadré | `voice-continuity-v1` + `simple-factual-composer` (Lune) | **Codé** — rejouer après reload |
| C3 | `NORMAL_CONVERSATION` + `DIRECT_EXPLANATION` + COMPOSER trop lourd après un rail court | Orchestration qui n’arrête pas | Ajustement d’orchestration (latence / coût) — pas une refonte | À écrire **avant** d’ouvrir | **Vigilance** — pas ouvert |
| C4 | Pattern détecté (`créer` + `application web` → projet site) appliqué **sans** vérifier qu’il correspond à la demande | Rail spécialisé = réponse ; pas d’étape « ce pattern est-il le bon type de réponse » | Cadrage : [`c4-response-type-decision.md`](./c4-response-type-decision.md). Lot 1 = champ `responseType` visible, **sans** gate `emit` | Lot 1 proposé dans le cadrage (pas codé) | **Cadrage ouvert — pas de runtime** |

Décisions = après les cartes. Les corrections **finalisent l’existant**, elles n’inventent pas une cible.

---

## Inventaire (photos, pas spec)

| Fichier | Quoi |
|---------|------|
| [`agent-front-doors.md`](./agent-front-doors.md) | Entrée |
| [`agent-upstream-decision.md`](./agent-upstream-decision.md) | Décision amont |
| [`agent-execution-delivery.md`](./agent-execution-delivery.md) | Livraison |
| [`agent-comprehension-conversation.md`](./agent-comprehension-conversation.md) | Compréhension |
| [`agent-intent-guards.md`](./agent-intent-guards.md) | Guards |
| [`agent-domain-policies.md`](./agent-domain-policies.md) | Policies domaine (vue séparée) |
| [`citadelle-vs-deepseek-harness.md`](./citadelle-vs-deepseek-harness.md) | Photo comparative DSH — pas une cible |
| [`c4-response-type-decision.md`](./c4-response-type-decision.md) | Cadrage C4 — type de réponse (C4.1–C4.2 runtime ; C4.3 pas ouvert) |
| [`pre-emit-coherence.md`](./pre-emit-coherence.md) | Cadrage pré-émission — job ↔ rail + anti-leak (pas de runtime) |

Registre packs : [`nexxus-routing-behavior-registry-v1.md`](../agents/nexxus-routing-behavior-registry-v1.md) — catalogue, pas fusionné ici.

---

## Interdit

- Transformer une carte en architecture cible.
- Fusionner topologie et registre.
- 3e doc amont, nouveau parser, rework des inventaires fermés pour « aligner » une idéale.
- Nouveau mode ou refonte globale pour « plus de simplicité ».
- Ouvrir un chantier non documenté (pas de problème observé / cause / correction / test).

---

## Journal

| Date | Changement |
|------|------------|
| 2026-08-18 | Méthode actée — inventaire pour décider |
| 2026-08-18 | Règle de travail : simplicité = contrôle du rail (simple / ambigu / complexe) |
| 2026-08-18 | Chantiers C1–C2 documentés (codés) ; C3 vigilance COMPOSER, pas ouvert |
| 2026-08-18 | Photo comparative DSH — [`citadelle-vs-deepseek-harness.md`](./citadelle-vs-deepseek-harness.md) |
| 2026-09-06 | Trou C4 documenté, **pas ouvert** — pattern sans décision de correspondance. Détail : [`agent-upstream-decision.md`](./agent-upstream-decision.md) §6.5 |
| 2026-09-06 | C4 cadrage ouvert, pas de runtime — [`c4-response-type-decision.md`](./c4-response-type-decision.md) |
