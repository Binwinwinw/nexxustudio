import { test, expect } from "@playwright/test";

const TIMEOUT = 20_000;
const IMPACT_TIMEOUT = 90_000;

async function openTab(page, name) {
  await page.getByRole("button", { name, exact: true }).click();
}

test.describe("Runtime chunk non-regression", () => {
  test("Audit and Projet render the correct deferred modules", async ({
    page,
    baseURL,
  }) => {
    await page.goto(baseURL || "http://localhost:5173", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("button", { name: "Audit", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Projet", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cockpit", exact: true }),
    ).toBeVisible();

    await openTab(page, "Cockpit");
    await expect(
      page.getByRole("heading", { name: /Citadel Cockpit/i }),
    ).toBeVisible({ timeout: TIMEOUT });

    await openTab(page, "Audit");
    await expect(
      page.getByRole("button", { name: "AUDITER", exact: true }),
    ).toBeVisible({ timeout: TIMEOUT });
    await expect(
      page.getByRole("button", { name: /Analyse de Depot|Analyse de Dépôt/i }),
    ).toBeVisible({ timeout: TIMEOUT });
    await expect(
      page.getByRole("heading", { name: /Citadel Cockpit/i }),
    ).toHaveCount(0);

    const targetInput = page.getByPlaceholder(
      /Chemin \(ex: server\/index\.js\)\.\.\./i,
    );
    await expect(targetInput).toBeVisible({ timeout: TIMEOUT });
    await targetInput.fill("server/index.js");
    const auditButton = page.getByRole("button", {
      name: "AUDITER",
      exact: true,
    });
    await expect(auditButton).toBeEnabled({ timeout: TIMEOUT });
    await auditButton.click();
    await expect
      .poll(
        async () => {
          const text = await page.locator("body").innerText();
          return /Rapport d'Impact Securise|Rapport d'Impact Sécurisé/i.test(
            text,
          );
        },
        { timeout: IMPACT_TIMEOUT, intervals: [500, 1000, 2000] },
      )
      .toBe(true);

    await openTab(page, "Projet");
    await expect(
      page.getByText(/Explorateur Forge|Visionneuse|Workspace:/i),
    ).toBeVisible({ timeout: TIMEOUT });
    await expect(
      page.getByRole("heading", { name: /Citadel Cockpit/i }),
    ).toHaveCount(0);
  });
});
