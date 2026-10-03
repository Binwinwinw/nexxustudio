# Closeout — PATCH-TERMINAL-UNVERIFIED-CAPABILITY-CLAIM-GUARD-V1

Trace opérationnelle, pas une nouvelle décision. Snapshot daté 2026-09-25.

```text
Lot :     PATCH-TERMINAL-UNVERIFIED-CAPABILITY-CLAIM-GUARD-V1
Verdict : PATCH CLOS ET VÉRIFIÉ
Commit :  14a49be feat(agent): sanitize unverified capability claims on buffered_final
Parent :  eb212d77b43af823d1e176109fc2ff0452b5f28c
Branche : wip/checkpoint-20260824-0117
Index :   vide après commit
Push/PR : aucun
```
Mise à jour — 2026-10-02 : le commit `14a49be` a été publié dans `origin/wip/checkpoint-20260824-0117`. Aucune PR vers `origin/main`.

Worktree volontairement non propre. Les autres fichiers dirty ou untracked ne sont pas attribués à ce lot.

---

## 1. Problème

Nexxus pouvait livrer des affirmations opérationnelles non vérifiées :

- URL documentaire fictive ;
- commande `npm` fictive ;
- audit de session ou rapport d’interactions fictif ;
- mémoire inter-session ou historique complet fictif ;
- capacité future présentée comme immédiatement disponible.

## 2. Graphe

- Composer peut inventer ces claims.
- `SECURITY_CONTRACT` peut pousser vers des affirmations d’accès, d’audit, de script ou de rapport.
- Les guards préexistants vivent surtout dans `enforceModeContract`.
- `conversation_recall` et d’autres textes pouvaient atteindre le terminal sans les traverser.
- `_finalizePipelineTurn` n’avait pas de filet URL / npm / audit / mémoire.

## 3. Correction retenue

Protection locale, fail-closed, **buffered only**.

Un appel à `sanitizeUnverifiedCapabilityClaim` dans `_finalizePipelineTurn` :

- après `enforceOutputLanguage` ;
- avant shadow / `recordTurn` / `emitOnContent` / return ;
- seulement si `deliveryMode === DELIVERY_MODES.BUFFERED_FINAL`.

Détection → remplacement **complet** par un fallback existant, déterministe, non vide. Aucun texte ad hoc. Aucun registre global. Aucun changement de prompt, `SECURITY_CONTRACT`, Composer, routing, recall ou streaming.

Fichiers du commit :

```text
server/src/agent/agentPipeline.js
server/src/agent/utils/quality-safety/unverifiedCapabilityClaimGuard.js
server/tests/unverified-capability-delivery.test.js
```

`agentPipeline.js` : deux hunks seulement (import + bloc `BUFFERED_FINAL`). Six hunks préexistants exclus du commit.

## 4. Couverture et préservations

Couvertes : URL documentaire hors query/history ; `npm run <script>` absent de `server/package.json` et non cité ; offre d’audit / rapport ; mémoire inter-session / historique complet ; capacité future « immédiatement disponible ».

Préservées : `npm run start` ; `vault:audit` ; tout script réel de `server/package.json` ; URL ou commande déjà dans query/history ; footer recall borné au fil courant ; limite honnête (« je ne peux pas vérifier X ici ») ; comportements meta-capability et packs déjà établis.

## 5. Preuve

```text
node --test --test-force-exit --test-timeout=15000 \
tests/unverified-capability-delivery.test.js
```

13 pass, 0 fail. Scénarios : URL fictive, `agent:session-audit`, audit/rapport, mémoire inter-session, future-now, préservations (`start`, `vault:audit`, citations, footer, limite honnête), `onContent` sanitisé en `buffered_final`, `already_streamed` non réécrit.

`git show --check` vert sur `14a49be`.

## 6. Résidus — hors lot, pas des bugs du commit

1. **`already_streamed`** — le texte peut être visible avant `_finalizePipelineTurn`. Le guard ne le retire pas rétroactivement.
2. **`SECURITY_CONTRACT`** — le prompt peut encore générer des claims. Le guard réduit la livraison buffered, pas la génération.
3. **Paraphrases hors patterns** — formulations assez différentes peuvent passer.
4. **Registre global absent** — le commit n’en crée pas et n’en prétend pas.
5. **URL web individuelle** — `hasWebEvidence` est un booléen. Il n’autorise pas une URL issue du web.

## 7. Reprise

Ne pas rouvrir ce lot. Relire cette note, relever l’état Git, puis un **seul** GO parmi :

| Axe | Quand |
|---|---|
| `RECON-ALREADY-STREAMED-OUTPUT-BOUNDARY-V1` | défaut si aucun nouvel incident — seul chemin de sortie hors couverture |
| `RECON-SECURITY-CONTRACT-CAPABILITY-CLAIM-PRESSURE-V1` | si on veut qualifier la pression prompt, sans modifier le prompt |
| `RECON-UNVERIFIED-CAPABILITY-CLAIM-PATTERN-EXPANSION-V1` | seulement si un nouveau cas observé existe |
| `RECON-CAPABILITY-AUTHORITY-REGISTRY-NEED-V1` | seulement si les sources actuelles (scripts + citation) deviennent insuffisantes |

Reconnaissance d’abord. Pas de patch streaming, prompt ou registre sans GO distinct.

**Défaut :** `RECON-ALREADY-STREAMED-OUTPUT-BOUNDARY-V1`.
