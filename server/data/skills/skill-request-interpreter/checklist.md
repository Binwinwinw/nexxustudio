# Checklist — skill-request-interpreter (candidat P4)

> Skill **désactivée** (`enabled: false`) — valider avant promotion.

## Stabilisation interne

- [x] Pack `micro/interpreter/` implémenté
- [x] Branché dans `intentShortCircuit` (après continuité P2)
- [x] Phase `subject_confirmation_pending` pour enchaînement confirm → oui
- [x] Tests `request-interpreter-p4.test.js` (0 fail)
- [x] Section P4 dans [[Micro-Conversation-Delestage]] v1.4

## Observation terrain (avant promotion)

- [ ] Smoke chat playbook P4 (noël bancal, ça ambigu, boules)
- [ ] Pas de sur-clarification sur requêtes déjà claires
- [ ] Télémétrie `request_interpreter_*` visible si Cockpit branché
- [ ] 2 semaines sans régression sur suite micro/familiarité

## Promotion skill runtime

- [ ] Passer `enabled: true` dans `meta.json`
- [ ] Entrer dans section Runtime-backed de [[SKILLS]]
- [ ] Retirer de Backlog candidats
- [ ] Mettre à jour `skill-micro-delestage` (référence skill enfant active)
