# Checklist — Browser Harness Phase C

## Avant implémentation

- [ ] Spec [[Browser-Harness-Phase-C]] relue
- [ ] `playwright-core` ou stratégie Chromium documentée
- [ ] `.gitignore` `server/src/data/browser-sessions/`

## C1 — Contrats & policy

- [x] `browserHarnessContract.js` — `validateObserveInput`, `buildObservationEnvelope`
- [x] `browserPolicy.js` — egress local-only (DRY avec Design Extract)
- [x] `browserHarnessObservability.js` — corrélation trace_id / browser_session_id
- [x] Tests contract sans Chromium

## C2 — Session

- [x] `browserSessionService.js` — launch / close / withBrowserSession
- [x] Session fermée en `finally` même sur erreur
- [x] Mock injectable pour CI
- [x] Tests session sans Chromium

## C3 — Observation

- [x] `browserStyleSampler.js` — sélecteurs, max 120, summary
- [x] `browserObservationService.js` — navigate, snapshot, styles, observePage
- [x] Tests mock : navigation OK, 404, styles partiels, timeout, close garanti

## C4 — Worker & artefacts

- [x] `browserHarnessWorker.js` — pipeline Observe → envelope
- [x] `browserTraceArtifacts.js` — observation.json + trace.jsonl
- [x] `BrowserHarnessJobManager.js` — jobs async + corrélation
- [x] Tests worker mock

## C5 — Intégration Design Extract

- [x] `designExtractStyleMerge.js`
- [x] Worker branch `extractionMode: hybrid`
- [x] Envelope `extraction_mode` + `computed_nodes`
- [x] Tests golden hybrid

## C6 — API

- [x] `POST /api/browser/observe`
- [x] `GET /api/browser/observe/:jobId`
- [x] `GET /api/browser/observe/:jobId/stream` (SSE)
- [x] Rate limit + `requireMandatorySession`
- [x] Tests API (5 scénarios)

## C7 — Golden tests

- [x] Fixtures `browser-golden/` (landing, components, dashboard)
- [x] Baselines `.envelope.00.json` + replay `.01.json`
- [x] Cas observe + hybrid + refus (404, timeout, contradiction)
- [x] `UPDATE_GOLDEN=1` pour régénérer les baselines

## Activation skill

- [ ] Tests mock 8/8 en premerge
- [ ] Design Extract hybrid validé sur fixture Citadelle
- [ ] `enabled: true` dans meta.json
- [ ] Entrée [[Index-Skills-Runtime-2026]] mise à jour
