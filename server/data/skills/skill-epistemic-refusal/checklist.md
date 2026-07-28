# Checklist : Epistemic Refusal

- [ ] Trigger « je ne sais pas » → skill-epistemic-refusal
- [ ] Trigger « propos créatif / idées créatives » → pas de refus (doNotUseWhen)
- [ ] Document joint + question → fallback skill-document-analysis
- [ ] Constante `INSUFFICIENT_SIGNAL_REFUSAL` utilisée (pas de variante)
- [ ] `evaluateEpistemicRefusal` retourne `shouldRefuse: true` sans contexte fiable
- [ ] Tests `mode-response-contracts.test.js` passent
- [ ] Matrice `skillTriggerMatrix` ≥ 0.85 accuracy
