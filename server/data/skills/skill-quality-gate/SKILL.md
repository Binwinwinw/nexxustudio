# Skill : Quality Gate (v1.0)

## Triggers (activation)
- « lancer quality gate », « test:stability », « certifier avant merge »
- Demande de régression conversation / routing / sécurité locale

## doNotUseWhen
- Utilisateur demande explicitement de sauter les tests

## Mission
Valider qu'une modification **ne régresse pas** le pipeline Nexxus avant livraison.

## Checklist commandes (depuis racine ou `server/`)
```bash
cd server && npm run test:stability
cd server && npm run test:conversation
cd server && npm run test:routing
npm run security:audit:local
cd server && npm run quality:gate
```

## Critères PASS
- Tous les tests stability PASS
- Aucune régression intent registry / upload guards / mode contracts
- Security audit local sans finding critique non documenté

## Modules code
- `server/scripts/quality-gate.js`
- `server/tests/conversation-stability.test.js`
- `server/tests/skillLoader.test.js`, `skillTriggerMatrix.test.js`

## KPI
- Durée gate < budget CI local documenté
- Taux échec post-merge → 0 sur releases certifiées
