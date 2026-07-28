# Playbook — Generator-First

## Objectif
Valider rapidement si une requête de livrable long déclenche bien le routage Generator-First, produit un artefact complet et laisse une trace exploitable dans Playwright.

## Préconditions
- Le frontend démarre correctement via Vite ou via webServer Playwright.
- La spec `tests/e2e/generator-first.spec.js` est à jour.
- Le `playwright.config.js` contient `baseURL`, le reporter HTML, les traces et le tag `@generator-first`.

## Lancement local
- **Exécution visible :** `npm run test:e2e:headed`
- **Exécution debug :** `npm run test:e2e:debug`
- **Lecture du rapport :** `npm run test:e2e:report`

## Signaux attendus
- Le log visible `⚡ Mode Generator-First activé : Bypass PM & Architect pour sécuriser le timeout.` apparaît.
- La requête saute la phase bavarde et démarre directement la production.
- Le livrable montre des indices réels de génération, par exemple `index.html`, `<!DOCTYPE html>`, `sidebar`, `Slide 1` ou `Questions & Contacts`.
- La fin de sortie ne contient ni `TODO`, ni placeholder, ni illusion de complétude.

## Si le test échoue
1. Ouvrir le rapport HTML Playwright.
2. Lire le `test.step()` exact qui casse.
3. Ouvrir la trace associée.
4. Vérifier successivement : activation du bypass, absence de bruit PM/Architect, démarrage réel du livrable, complétude finale, erreurs console/réseau.
5. Classer l’échec : classifier, routing, execution, completeness, transport ou selector.

## Seuil de décision
- **Succès :** bypass visible, génération longue démarrée, sortie complète.
- **Alerte :** bypass actif mais sortie tronquée ou timeout.
- **Escalade :** si l’alerte se répète, ouvrir le chantier ADR-016 pour continuité/streaming par chunks.

## Traçabilité CI
- Le rapport doit afficher la branche, le SHA court et le run ID.
- Conserver junit, json, html et les artefacts Playwright sur les runs CI.
- Réduire la rétention si les quotas GitHub augmentent trop vite.
