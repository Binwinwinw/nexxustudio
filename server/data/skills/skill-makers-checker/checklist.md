# Checklist : Makers Checker

- [ ] `MakersChecker.validateDecision` retourne `confirmed` si consensus ≥ 0.85
- [ ] Mode `fallbackToPrimary: true` → `fallback-primary` si consensus bas
- [ ] Mode `fallbackToPrimary: false` → `blocked` fail-closed
- [ ] Sécurité `blocked` refuse la décision (fail-closed)
- [ ] `assessHallucinationRisk` ≥ 0.4 sans sources + claims factuels
- [ ] `generateReport` produit Markdown complet
- [ ] Tests `makers-checker.test.js` passent
- [ ] CI `test:skills` — 26 skills, 0 error
