# Checklist — skill-micro-delestage

Référence gouvernance : [[Regle-Ancrage-Micro-Outils]] (5 ancrages minimum).

- [ ] `runConversationShortCircuit` est appelé **avant** SIMPLE_FAST dans `agentPipeline.js`
- [ ] Identité / idéation / familiarité ne produisent pas `INSUFFICIENT_SIGNAL_REFUSAL`
- [ ] Formes de surface correctes (`l'Italie`, `le musée du Louvre`)
- [ ] Registre lieu sans verbes techniques absurdes
- [ ] Tests micro + contrats conversationnels + P4 passent (0 fail)
- [ ] Télémétrie : path `*_deterministic` visible si Cockpit branché
