# Checklist : Intent Routing

- [ ] `resolveIntentContract` a-t-il été consulté avec le `packet` enrichi (PJ, meta) ?
- [ ] SIMPLE_FAST est-il bypassé quand `shouldBypassSimpleFast` le exige ?
- [ ] Le `responseMode` correspond-il au contrat (`DOCUMENT`, `OPEN_PROPOSITION`, etc.) ?
- [ ] Les logs mentionnent-ils `IntentContract=` et `matchedBy=` ?
- [ ] Au plus 1–2 experts actifs sur la tâche ?
- [ ] Pas de mismatch entre intention utilisateur et mode composer ?
