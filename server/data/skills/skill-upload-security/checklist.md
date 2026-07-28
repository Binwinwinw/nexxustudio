# Checklist : Upload Security

- [ ] `uploadGuards` a-t-il été appliqué avant traitement du buffer ?
- [ ] Double extension → 403 + `UPLOAD_REJECTED` ?
- [ ] Le MIME correspond-il à l'extension déclarée ?
- [ ] Le frontend affiche-t-il le message sécurité sans crasher ?
- [ ] Aucun secret ou script exécutable ingéré par erreur ?
- [ ] Logs serveur traçables (`[UPLOAD]` ou équivalent) ?
