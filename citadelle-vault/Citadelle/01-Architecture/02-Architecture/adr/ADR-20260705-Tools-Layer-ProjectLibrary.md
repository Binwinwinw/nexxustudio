# ADR-20260705 : Tools Layer — projectLibrary (Legacy/Experimental)

## Statut

**Accepté — Option B** (05/07/2026)

## Contexte

`projectLibrary.js` indexe le patrimoine `/projects` via embeddings Ollama et persiste l'index dans `server/data/projects_index.json`. L'intention doctrine est valide, mais l'audit de traversée (2026-07-05) montre que cette brique **n'est pas un couloir réellement vivant** :

1. `BlueprintGenerator` importe `projectLibrary.search()` mais n'est référencé par aucun autre module runtime — brique orphelin.
2. `librarianSearch` appelle `memoryOrchestrator.getRelevantMemory(..., { scope: 'heritage' })` — **pas** `projectLibrary`.
3. L'architecture récente converge vers **Knowledge Hub / Chroma** comme savoir canonique gouverné.

Un second axe patrimoine `/projects` non raccordé augmente la dette cognitive sans signal d'usage terrain.

## Décision

**Option B — Archiver / isoler.**

- `projectLibrary` est classé **Legacy/Experimental**.
- Le patrimoine officiel et la récupération d'héritage reposent sur **Knowledge Hub / Chroma** via `memoryOrchestrator`.
- `projectLibrary` ne fait **pas** partie du noyau AGENTS.md ni des garanties runtime.
- Toute réactivation future nécessite : smoke test dédié, rebranchage explicite, et **ADR de sortie de legacy**.

## Conséquences

- `librarianSearch` reste l'outil agent d'héritage, mais sa description et son exécution reflètent Knowledge Hub / heritage — pas `/projects` embeddings.
- `VaultConsultant` et `BlueprintGenerator` ne doivent plus importer `projectLibrary` ; ils s'appuient sur `memoryOrchestrator` / `knowledgeService`.
- `BlueprintGenerator` reste **experimental / non branché** au pipeline Forge vivant.
- Le fichier `projectLibrary.js` est conservé avec tag legacy pour référence historique, sans import depuis le noyau agent.

## Validation

Option B validée lorsque :

- [x] ADR passée en **Accepted**.
- [x] Imports résiduels retirés ou `@deprecated` (`vaultConsultant`, `blueprintGenerator`).
- [x] `toolRegistry` et `toolPolicy` alignés sur heritage Knowledge Hub.
- [x] Registre Tools Layer v1 mis à jour (Legacy-experimental).

## Plan

| Étape | Statut |
|-------|--------|
| Tag `@legacy-experimental` sur `projectLibrary.js` | Fait |
| Retirer import `projectLibrary` de `vaultConsultant` → `memoryOrchestrator` | Fait |
| Retirer import `projectLibrary` de `blueprintGenerator` | Fait |
| Aligner descriptions `librarianSearch` | Fait |
| Réouverture (Option A) | Uniquement si usage terrain + nouvelle ADR |

## Références

- `server/src/tools/projectLibrary.js`
- `server/src/agent/skills/blueprintGenerator.js`
- `server/src/agent/knowledge/vaultConsultant.js`
- `server/src/agent/utils/toolExecutor.js` (case `librarianSearch`)
- ADR-20260705-Tools-Layer-Classification-v1.md
- ADR-20260613-Knowledge-Hub-Gouverne.md
