// tests/e2e/generator-first.spec.js
import { test, expect } from '@playwright/test';

const PROMPT =
  "Crée un fichier complet index.html. Sois extrêmement bref (< 30 lignes). Le code DOIT contenir exactement ces mots : 'slide 1', 'quiz', 'contacts', 'Q&A', 'sidebar' et 'navigation'.";

const GENERATOR_FIRST_LOG =
  "⚡ Mode Generator-First activé : Bypass PM & Architect pour sécuriser le timeout.";

test.describe('Generator-First bypass', () => {
  test.setTimeout(8 * 60 * 1000);

  test('active le bypass generator-first et produit un long livrable sans bruit métacognitif', async ({ page }, testInfo) => {
    const consoleMessages = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => pageErrors.push(String(err)));
    page.on('requestfailed', req => {
      failedRequests.push({
        url: req.url(),
        method: req.method(),
        error: req.failure()?.errorText || 'unknown',
      });
    });

    await test.step('Ouvrir Nexxus Studio', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await closeBlockingOverlays(page);
      await page.screenshot({
        path: testInfo.outputPath('01-app-opened.png'),
        fullPage: true,
      });
    });

    await test.step('Trouver la zone de prompt et envoyer la requête longue', async () => {
      const promptBox = await findPromptInput(page);
      await expect(promptBox).toBeVisible();

      await fillPrompt(promptBox, PROMPT);

      const sendButton = await findSendButton(page);
      await expect(sendButton).toBeVisible();
      await sendButton.click();

      await page.screenshot({
        path: testInfo.outputPath('02-prompt-submitted.png'),
        fullPage: true,
      });
    });

    await test.step('Vérifier l’activation visible du mode Generator-First', async () => {
      const generatorFirstVisibleLog = page.getByText(GENERATOR_FIRST_LOG, { exact: false }).first();
      await expect(generatorFirstVisibleLog).toBeVisible({ timeout: 30_000 });

      await page.screenshot({
        path: testInfo.outputPath('03-generator-first-log.png'),
        fullPage: true,
      });
    });

    await test.step('Vérifier l’absence de phase bavarde PM/Architect', async () => {
      await assertNoPMArchitectNoise(page);
    });

    await test.step('Attendre la fin de la génération du livrable long', async () => {
      const stopButton = page.locator('#nexxus-emergency-stop');
      // On attend que le système active la Forge (bouton STOP visible)
      await expect(stopButton).toBeVisible({ timeout: 30_000 });
      // On attend que la Forge termine sa génération (bouton STOP caché)
      await expect(stopButton).toBeHidden({ timeout: 8 * 60 * 1000 });

      await page.screenshot({
        path: testInfo.outputPath('04-generation-finished.png'),
        fullPage: true,
      });
    });

    await test.step('Contrôler la complétude visible du résultat', async () => {
      const bodyText = await page.locator('body').innerText();

      expect.soft(bodyText.toLowerCase()).toContain('index.html');
      expect.soft(
        bodyText.includes('<!DOCTYPE html') || bodyText.includes('<html') || bodyText.includes('```html')
      ).toBeTruthy();
      expect.soft(
        bodyText.toLowerCase().includes('sidebar') ||
        bodyText.toLowerCase().includes('navigation')
      ).toBeTruthy();
      expect.soft(bodyText.toLowerCase()).toContain('slide 1');
      expect.soft(
        bodyText.toLowerCase().includes('questions') ||
        bodyText.toLowerCase().includes('contacts') ||
        bodyText.toLowerCase().includes('q&a')
      ).toBeTruthy();
      expect.soft(
        bodyText.toLowerCase().includes('quiz')
      ).toBeTruthy();

      await assertNoIllusionOfCompleteness(page);

      await page.screenshot({
        path: testInfo.outputPath('05-final-state.png'),
        fullPage: true,
      });
    });

    await test.step('Contrôler la santé globale du flux', async () => {
      expect.soft(pageErrors, `Page errors: \${pageErrors.join('\\n')}`).toEqual([]);

      const nonStaticFailures = failedRequests.filter(req => {
        return !/\\.(png|jpg|jpeg|webp|svg|ico|woff2?|css|map)$/i.test(req.url);
      });

      expect.soft(
        nonStaticFailures,
        `Failed network requests: \${JSON.stringify(nonStaticFailures, null, 2)}`
      ).toEqual([]);

      const bodyText = await page.locator('body').innerText();
      expect.soft(
        consoleMessages.some(m => m.includes('Generator-First activé')) ||
        bodyText.includes('Generator-First activé')
      ).toBeTruthy();
    });
  });
});

async function closeBlockingOverlays(page) {
  const candidates = [
    page.getByRole('button', { name: /accepter|autoriser|ok|fermer|close|dismiss/i }),
    page.getByRole('button', { name: /got it|continue|compris/i }),
  ];

  for (const locator of candidates) {
    try {
      if (await locator.first().isVisible({ timeout: 1200 })) {
        await locator.first().click();
      }
    } catch (_) {}
  }
}

async function findPromptInput(page) {
  const candidates = [
    page.getByTestId('chat-input'),
    page.getByRole('textbox', { name: /message|prompt|demande|requête|chat/i }),
    page.getByPlaceholder(/message|prompt|décris|demandez|écris|écrire/i),
    page.locator('textarea').first(),
    page.locator('input[type="text"]').first(),
    page.locator('[contenteditable="true"]').first(),
  ];

  for (const locator of candidates) {
    try {
      await locator.waitFor({ state: 'visible', timeout: 3000 });
      return locator;
    } catch (_) {}
  }

  throw new Error("Impossible de trouver le champ de saisie du prompt.");
}

async function fillPrompt(locator, value) {
  const tagName = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => null);
  const isContentEditable = await locator.evaluate(el => el.isContentEditable).catch(() => false);

  if (isContentEditable) {
    await locator.click();
    await locator.evaluate((el, text) => {
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    }, value);
    return;
  }

  if (tagName === 'textarea' || tagName === 'input') {
    await locator.fill(value);
    return;
  }

  await locator.click();
  await locator.pressSequentially(value, { delay: 5 });
}

async function findSendButton(page) {
  const candidates = [
    page.getByTestId('send-button'),
    page.getByRole('button', { name: /envoyer|send|lancer|générer|soumettre/i }),
    page.locator('button[type="submit"]').first(),
    page.locator('button').filter({ hasText: /envoyer|send|lancer|générer/i }).first(),
  ];

  for (const locator of candidates) {
    try {
      await locator.waitFor({ state: 'visible', timeout: 3000 });
      return locator;
    } catch (_) {}
  }

  throw new Error("Impossible de trouver le bouton d'envoi.");
}

async function assertNoPMArchitectNoise(page) {
  const forbiddenHints = [
    /expert_pm/i,
    /expert_architect/i,
    /phase.*pm/i,
    /phase.*architect/i,
    /plan d['’]implémentation/i,
    /avant de commencer/i,
    /j[’']ai besoin de vos retours/i,
    /voici le plan/i,
    /open questions/i,
  ];

  await expect
    .poll(
      async () => {
        const txt = await page.locator('body').innerText();
        return forbiddenHints.some(rx => rx.test(txt));
      },
      {
        timeout: 20_000,
        intervals: [500, 1000, 2000],
      }
    )
    .toBeFalsy();
}

async function assertNoIllusionOfCompleteness(page) {
  const badPatterns = [
    /<!--\\s*\\.\\.\\.\\s*-->/i,
    /\\.\\.\\./,
    /contenu à compléter/i,
    /à faire/i,
    /\\bTODO\\b/i,
    /placeholder/i,
    /lorem ipsum/i,
    /[[]?insert/i,
    /etc\\./i,
  ];

  const txt = await page.locator('body').innerText();

  for (const rx of badPatterns) {
    expect.soft(
      rx.test(txt),
      `Pattern d'illusion de complétude détecté: \${rx}`
    ).toBeFalsy();
  }
}
