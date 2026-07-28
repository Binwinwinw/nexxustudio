# Skill : Upload Security (v1.0)

## Mission
Garantir que les pièces jointes acceptées sont **sûres, typées et exploitables** — refus explicite sinon.

## Contrôles
1. **Double extension** (ex. `.php.txt`) → rejet **403** + code `UPLOAD_REJECTED`.
2. **MIME + extension** alignés — texte, code, markdown, images autorisées selon policy Multer.
3. **Message utilisateur** structuré côté frontend (`ChatBento`, `App.jsx`).
4. **Fail-closed** : en cas de doute sur le type ou le nom → refuser, ne pas ingérer.

## Modules code
- `shared/uploadGuards.js` — `rejectDoubleExtension`, validation nom.
- `server/index.js` — configuration Multer, handlers d'erreur HTTP.
- `src/App.jsx` / `src/components/ChatBento.jsx` — affichage alerte sécurité.

## Réponse attendue en cas de rejet
- Expliquer **pourquoi** (extension multiple, type non supporté).
- Ne pas suggérer de contourner la sécurité.
- Proposer un format sûr (`.txt`, `.md`, `.js` selon contexte).

## Interdictions
- Ne jamais accepter silencieusement un fichier ambigu.
- Ne pas stocker de secrets extraits d'un upload dans localStorage.
- Ne pas bypasser Multer « pour tester » en production.
