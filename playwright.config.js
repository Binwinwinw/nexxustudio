// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 5173;
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const IS_CI = !!process.env.CI;

const GIT_SHA =
  process.env.GITHUB_SHA ||
  process.env.CI_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  'local';

const GIT_REF =
  process.env.GITHUB_REF_NAME ||
  process.env.CI_COMMIT_REF_NAME ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  'local';

const RUN_ID =
  process.env.GITHUB_RUN_ID ||
  process.env.CI_PIPELINE_ID ||
  `local-${Date.now()}`;

const REPORT_TITLE = `La Citadelle E2E • ${GIT_REF} • ${GIT_SHA.slice(0, 8)} • run ${RUN_ID}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 8 * 60 * 1000,
  expect: {
    timeout: 15_000,
  },

  fullyParallel: false,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : undefined,

  reporter: IS_CI
    ? [
        ['dot'],
        ['html', { open: 'never', outputFolder: 'playwright-report', title: REPORT_TITLE }],
        ['junit', { outputFile: 'test-results/junit.xml' }],
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : [
        ['list', { printSteps: true }],
        ['html', { open: 'on-failure', outputFolder: 'playwright-report', title: REPORT_TITLE }],
      ],

  tag: '@generator-first',

  use: {
    baseURL: BASE_URL,
    headless: IS_CI,
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,

    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: IS_CI ? 'on-first-retry' : 'retain-on-failure',

    actionTimeout: 20_000,
    navigationTimeout: 90_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: IS_CI
          ? 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173'
          : 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: BASE_URL,
        timeout: 120 * 1000,
        reuseExistingServer: !IS_CI,
        stdout: 'pipe',
        stderr: 'pipe',
      },

  outputDir: 'test-results/artifacts',
});
