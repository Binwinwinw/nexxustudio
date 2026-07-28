---
name: webapp-testing
description: Exécute et écrit des tests Playwright E2E pour MonCoachScolaire. Utiliser quand il faut valider l'affichage d'exercices, tester un formulaire, vérifier la navigation, ou écrire un smoke test après un patch CSS/JS/PHP. Tests dans tests/*.spec.ts, config dans playwright.config.js.
argument-hint: [page ou fonctionnalité à tester]
---

# Skill — Webapp Testing (Playwright E2E)

## Objectif

Écrire, exécuter ou diagnostiquer des tests Playwright E2E pour MonCoachScolaire.

## Structure des tests

```
tests/
├── exercise-display.spec.ts   ← Test d'affichage des exercices
├── Parsers/                   ← Tests unitaires des parsers
playwright.config.js           ← Config Playwright
```

## Quand utiliser

- Valider l'affichage d'une page après un patch HTML/CSS
- Tester un flux exercice (chargement → réponse → feedback)
- Vérifier un filtre (niveau, matière, difficulté)
- Smoke test rapide après déploiement
- Diagnostiquer un test qui échoue

## Commandes

```powershell
# Tous les tests
npx playwright test

# Un test spécifique
npx playwright test tests/exercise-display.spec.ts

# Mode debug (navigateur visible)
npx playwright test --headed

# Rapport HTML
npx playwright show-report
```

## Template de test (nouveau spec)

```typescript
import { test, expect } from "@playwright/test";

test.describe("Nom de la fonctionnalité", () => {
  test.beforeEach(async ({ page }) => {
    // Naviguer vers la page cible
    await page.goto("/src/pages/system/cours.php?niveau=seconde&matiere=maths");
  });

  test("affiche les exercices du niveau", async ({ page }) => {
    // Vérifier la présence des éléments clés
    await expect(page.locator(".exercise-card")).toHaveCount.greaterThan(0);
    await expect(page.locator("h1")).toContainText("Mathématiques");
  });

  test("filtre par matière fonctionne", async ({ page }) => {
    await page.selectOption("[data-subject-filter]", "maths");
    await expect(page.locator('[data-exercise-matiere="maths"]')).toBeVisible();
  });

  test("bouton démarrer exercice navigue correctement", async ({ page }) => {
    await page.locator(".btn-start-exercise").first().click();
    await expect(page).toHaveURL(/exercice/);
  });
});
```

## Hooks JS/CSS à ne pas casser

Lors de la modification HTML, vérifier que ces sélecteurs Playwright restent valides :

| Sélecteur                 | Usage                     |
| ------------------------- | ------------------------- |
| `.exercise-card`          | Carte d'exercice          |
| `[data-subject-filter]`   | Filtre matière            |
| `[data-exercise-matiere]` | Attribut matière exercice |
| `.btn-start-exercise`     | Bouton démarrer           |
| `#exercise-feedback`      | Zone feedback réponse     |
| `[data-level]`            | Attribut niveau           |

## Diagnostic d'un test en échec

1. Lancer `npx playwright test --headed` pour voir le navigateur
2. Vérifier que le serveur local est démarré (PHP built-in ou Apache/Nginx)
3. Vérifier `playwright.config.js` → `baseURL` pointe vers le bon host
4. Ajouter `await page.pause()` pour inspecter en mode debug
5. Vérifier les sélecteurs avec `page.locator('.class').count()`

## Règles

- Ne pas modifier les sélecteurs JS existants pour faire passer un test — adapter le test ou corriger la source
- Les tests doivent être reproductibles (pas de dépendance à l'état BDD)
- Préfixer les nouveaux fichiers de test avec la fonctionnalité testée
