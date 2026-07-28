# Archive — `session_owners.json`

Fichier déplacé depuis `server/data/session_owners.json` le **2026-07-19** (vague 1 migration storage).

## Contexte

Inventaire `docs/server-data-inventory.md` : **aucune référence** dans le code Node actuel. L’ownership browser↔session est géré via la base (`sessionAccessService.js` + `sessionRepository`).

## Contenu

Snapshot JSON historique des propriétaires de session (legacy fichier). Conservé ici pour audit / rollback éventuel, **pas** rechargé par le runtime.

## Action future

Après confirmation prod (pas de montage / backup script dépendant de ce path), suppression définitive possible.
