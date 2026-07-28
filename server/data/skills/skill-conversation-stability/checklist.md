# Checklist : Conversation Stability

- [ ] Le chemin modifié stream-t-il via `onContent` par chunks ?
- [ ] `enforceModeContract` appliqué sur la réponse finale ?
- [ ] `npm run test:stability` (ou sous-ensemble pertinent) exécuté ?
- [ ] Pas de fuite `<think>` / Reasoning dans la bulle UI ?
- [ ] Intent contract cohérent avec le comportement observé ?
- [ ] Incident loggé si fallback ou refus inattendu ?
