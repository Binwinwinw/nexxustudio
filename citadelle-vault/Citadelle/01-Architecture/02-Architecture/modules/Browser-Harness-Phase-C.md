# Module : Browser Harness — Phase C (local-only)

**Statut** : spec validée — 27/05/2026  
**Produit** : Nexxus Browser / Web Operator  
**Skill** : `skill-browser-harness` (`enabled: false` jusqu'à Phase C livrée)  
**Consommateurs prioritaires** : Design Extract v2.1, Impeccable (futur), QA Nexxus Studio

**ADR parent** : [[ADR-20260601-Suite-Design-Nexxus]] · [[Design-Extract-Worker]]

---

## 1. Positionnement

Le Browser Harness est une **capacité transversale d'observation web instrumentée** — pas un skill chat omnivore.

```
                    ┌─────────────────────┐
                    │  Browser Harness    │
                    │  Observe · Trace    │
                    └──────────┬──────────┘
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
   Design Extract         Impeccable          QA / Debug
   (getComputedStyle)     (verify visuel)     (console/réseau)
```

**Doctrine Phase C** :
- **local-only** par défaut — localhost / réseau privé uniquement
- **lecture seule** — pas d'actions destructives sans confirmation explicite
- **session isolée** — Chromium éphémère, fermeture garantie
- **trace obligatoire** — `trace_id` + `browser_session_id` sur chaque opération
- **fail-closed** — egress refusé → pas de navigation de repli

---

## 2. Périmètre Phase C vs phases ultérieures

| Phase | Périmètre | Statut |
|-------|-----------|--------|
| **C (cible)** | Session locale, navigation allowlistée, snapshot DOM, `getComputedStyle`, screenshot optionnel, intégration Design Extract `extraction_mode: rendered` | C1–C4 ✅ worker |
| D | Actions gouvernées (clic, saisie) avec confirmation | futur |
| E | Intents chat `WEB_*` + routage orchestrateur | futur |
| F | Impeccable verify visuel post-Forge | futur |

Phase C **n'active pas** le skill en production chat — c'est une **lib runtime** consommée par Design Extract et l'API opérateur.

---

## 3. Architecture runtime

### Arborescence cible

```
server/src/services/browser-harness/
├── browserHarnessContract.js      # validateObserveInput, buildObservationEnvelope
├── browserPolicy.js               # egress local-only, allowlist, timeouts
├── browserSessionService.js       # cycle de vie Chromium (launch → close)
├── browserObservationService.js   # navigate, snapshot DOM, getComputedStyle
├── browserStyleSampler.js         # sélecteurs cibles, max 120 nœuds
├── browserTraceArtifacts.js       # persistance traces, screenshots, JSON
├── browserHarnessWorker.js        # orchestrateur Observe pipeline
└── BrowserHarnessJobManager.js    # jobs async + SSE (optionnel Phase C)

server/data/skills/skill-browser-harness/
├── meta.json                      # enabled: false
├── SKILL.md
└── checklist.md
```

### Dépendance Playwright

- Réutiliser `@playwright/test` déjà présent à la racine du monorepo pour CI.
- Côté **server runtime** : ajouter `playwright-core` (prod optional peer) ou lancer via worker isolé.
- Variable d'environnement : `BROWSER_HARNESS_CHROMIUM_PATH` (fallback `npx playwright install chromium`).
- **Headless obligatoire** en CI ; headed autorisé en dev local via flag opérateur.

---

## 4. Pipeline Observe (Phase C)

### Étapes séquentielles

| Step ID | Nom | Entrée | Sortie | Fail-closed |
|---------|-----|--------|--------|-------------|
| `browser.observe.validate` | URL + policy + viewport | `{ url, egressPolicy, viewport }` | OK / violations | Oui |
| `browser.observe.launch` | — | — | `browser_session_id` | Oui si Chromium indisponible |
| `browser.observe.navigate` | URL allowlistée | — | `response_status`, `final_url` | Oui timeout / 4xx |
| `browser.observe.wait` | stratégie stable | — | `dom_stable_at` | Dégradé après 8s |
| `browser.observe.snapshot` | DOM rendu | — | `dom_html`, `title`, meta | Non |
| `browser.observe.styles` | sélecteurs cibles | — | `computed_styles[]` | Non (partial OK) |
| `browser.observe.screenshot` | viewport | — | `screenshot_path` (opt-in) | Non |
| `browser.observe.close` | — | — | session fermée | Toujours (finally) |
| `browser.observe.pack` | agrégat | — | `observation_envelope` | Oui |

### Stratégie d'attente DOM

1. `domcontentloaded` (timeout 12s)
2. Attente `networkidle` optionnelle (max 4s, skip si SPA longue)
3. Fallback : `waitForSelector('body', { timeout: 3000 })`

### Sélecteurs & propriétés CSS

Identiques à [[Design-Extract-Worker]] §2 — max **120 nœuds** :

```javascript
export const STYLE_SAMPLE_SELECTORS = [
  'html', 'body', 'header', 'nav', 'main', 'section', 'article',
  'footer', 'aside', 'h1', 'h2', 'h3', 'p', 'a', 'button',
  '[role="button"]', 'input', 'label',
  '[class*="btn"]', '[class*="card"]', '[class*="hero"]', '[class*="nav"]',
];

export const COMPUTED_STYLE_PROPS = [
  'color', 'background-color', 'border-color',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'gap',
  'border-radius', 'box-shadow',
  'display', 'grid-template-columns', 'flex-direction',
];
```

Chaque échantillon :

```json
{
  "selector": "button.btn-primary",
  "tag": "button",
  "classes": ["btn-primary", "cta"],
  "bbox": { "x": 24, "y": 480, "width": 160, "height": 44 },
  "styles": { "color": "rgb(255, 255, 255)", "background-color": "rgb(99, 102, 241)" },
  "hint": "cta"
}
```

---

## 5. Politique egress & sécurité

### Modes

| Mode | Hosts autorisés | Usage |
|------|-----------------|-------|
| `local-only` (défaut) | `localhost`, `127.0.0.1`, `::1`, RFC1918 | QA Nexxus Studio, Design Extract |
| `hybrid-controlled` | Public via `assertEgressUrlAllowed` + `checkUrlPolicy` | futur, désactivé Phase C |

Réutiliser la logique de `designExtractPolicy.js` — **DRY** via export partagé ou module `sharedEgressPolicy.js`.

### Garde-fous session

| Règle | Valeur |
|-------|--------|
| Timeout navigation | 12 000 ms |
| Timeout session totale | 45 000 ms |
| Max pages / session | 1 (Phase C) |
| Téléchargements | Bloqués |
| Upload fichier | Bloqué Phase C |
| Popups | `dismiss` automatique |
| JavaScript | Activé (rendu fidèle) |
| Cookies tiers | Isolés — pas de persistance cross-session |

### Identifiants de corrélation

```json
{
  "trace_id": "uuid-v4",
  "browser_session_id": "bsess-{timestamp}-{random}",
  "job_id": "job-browser-{...}"
}
```

---

## 6. Schéma JSON — Observation Envelope (v1.0.0)

```json
{
  "version": "1.0.0",
  "kind": "nexxus.browser.observation_result",
  "skill_id": "skill-browser-harness",
  "source": {
    "url": "http://127.0.0.1:5173/",
    "final_url": "http://127.0.0.1:5173/",
    "observed_at": "2026-05-27T14:00:00.000Z",
    "response_status": 200,
    "viewport": { "width": 1440, "height": 900 }
  },
  "session": {
    "browser_session_id": "bsess-...",
    "trace_id": "trace-...",
    "duration_ms": 3200,
    "engine": "chromium/playwright"
  },
  "dom_snapshot": {
    "title": "Nexxus Studio",
    "html_bytes": 48200,
    "node_count_estimate": 340
  },
  "computed_styles": [],
  "style_summary": {
    "samples_count": 87,
    "unique_colors": 12,
    "unique_font_families": 2
  },
  "artifacts": {
    "observation_json": "server/src/data/browser-sessions/{sessionId}/observation.json",
    "screenshot_png": null,
    "dom_html": null
  },
  "uncertainties": [],
  "generated_at": "2026-05-27T14:00:03.000Z"
}
```

---

## 7. Intégration Design Extract v2.1

### Mode hybrid merge

Quand `extractionMode: "rendered"` ou `"hybrid"` :

```
Design Extract Worker
  ├─ static path (cheerio)     → color_samples_static
  ├─ browser.observe (harness) → computed_styles
  └─ designExtractStyleMerge.js
        → color_samples merged (computed prioritaire)
        → extraction_mode: "hybrid"
        → computed_nodes: N
        → uncertainties réduites
```

### Nouveau module

`server/src/services/design-extract/designExtractStyleMerge.js`

| Source | Priorité |
|--------|----------|
| `getComputedStyle` | 1 (ground truth visuel) |
| inline / `<style>` cheerio | 2 (complément) |

### Envelope 2.0.0 enrichie

```json
{
  "source": {
    "extraction_mode": "hybrid",
    "viewport": { "width": 1440, "height": 900 },
    "browser_session_id": "bsess-..."
  },
  "signals": {
    "computed_nodes": 87,
    "static_nodes": 45
  }
}
```

### API Design Extract — body étendu

```json
{
  "url": "http://127.0.0.1:5173/",
  "egressPolicy": "local-only",
  "extractionMode": "hybrid",
  "viewport": { "width": 1440, "height": 900 },
  "captureScreenshot": false
}
```

---

## 8. API opérateur (Phase C)

Routes sous session obligatoire (`requireMandatorySession`) :

```
POST   /api/browser/observe          # lance observation sync ou async
GET    /api/browser/stream/:jobId    # SSE si async
GET    /api/browser/sessions/:id     # statut + envelope
DELETE /api/browser/sessions/:id     # abort + cleanup
```

### POST `/api/browser/observe`

```json
{
  "url": "http://127.0.0.1:5173/",
  "egressPolicy": "local-only",
  "viewport": { "width": 1440, "height": 900 },
  "captureScreenshot": false,
  "async": true
}
```

Réponse sync (petites pages) ou `{ jobId, stream_url, trace_id, browser_session_id }`.

Rate limit : 8 req / 60s (plus strict que Design Extract — coût Chromium).

---

## 9. Routage intents (Phase E — spec anticipée)

Non activé Phase C ; registre prévisionnel :

| Intent | Priorité | Guard | Mode | asyncJob |
|--------|----------|-------|------|----------|
| `WEB_OBSERVE` | 770 | `isWebObserveIntent` | DOCUMENT | true |
| `WEB_EXTRACT` | 765 | `isWebExtractIntent` | DOCUMENT | true |
| `WEB_VERIFY` | 760 | `isWebVerifyIntent` | CRITICAL | true |
| `WEB_TEST` | 755 | `isWebTestIntent` | CRITICAL | true |

**Règle** : max 1 intent browser par tour ; pas de parallèle avec VIDEO_ANALYSIS.

---

## 10. Persistance artefacts

Chemin : `server/src/data/browser-sessions/{browser_session_id}/`

| Fichier | Contenu |
|---------|---------|
| `observation.json` | Envelope complète |
| `computed-styles.json` | Échantillons bruts |
| `screenshot.png` | Si `captureScreenshot: true` |
| `dom.html` | Snapshot HTML (opt-in, max 2 Mo) |
| `trace.jsonl` | Steps timeline |

`.gitignore` : `server/src/data/browser-sessions/`

---

## 11. Tests (sans LLM, sans réseau externe)

### Stratégie

1. **Mock Playwright** — injecter `page` fake dans `browserObservationService` pour CI sans Chromium.
2. **Fixture HTML locale** — servir via `node:http` static sur port éphémère en test d'intégration opt-in.
3. **Golden merge** — `design-extract-hybrid.test.js` compare envelope hybrid vs static.

### Cas obligatoires

| Test | Assertion |
|------|-----------|
| `browserPolicy: local-only autorise 127.0.0.1` | OK |
| `browserPolicy: bloque example.com` | `EGRESS_LOCAL_ONLY` |
| `browserStyleSampler: max 120 nœuds` | length ≤ 120 |
| `browserObservationService mock: extrait computed_styles` | ≥ 1 sample avec color |
| `browserHarnessWorker: session fermée en finally` | close appelé même si navigate fail |
| `designExtractStyleMerge: computed prioritaire` | merged samples count > static |
| `designExtractWorker hybrid: extraction_mode hybrid` | envelope.source.extraction_mode |
| `golden-hybrid-citadelle: merge_ok true` | quality_gate.merge_ok |

### Test opt-in Chromium réel

```bash
BROWSER_HARNESS_E2E=1 node --test tests/browser-harness-e2e.test.js
```

Non exécuté en premerge par défaut (comme Ollama).

---

## 12. Skill scaffold (disabled)

`server/data/skills/skill-browser-harness/meta.json` :

```json
{
  "name": "Browser Harness",
  "version": "0.1.0",
  "enabled": false,
  "requiresRuntime": true,
  "tier": "infrastructure",
  "intentIds": [],
  "runtimeModules": [
    {
      "path": "server/src/services/browser-harness/browserHarnessContract.js",
      "exportName": "validateObserveInput",
      "required": true,
      "status": "planned"
    }
  ],
  "testFiles": ["server/tests/browser-harness-contract.test.js"]
}
```

Activation skill (`enabled: true`) **uniquement après** :
1. Phase C runtime livré
2. Design Extract hybrid validé
3. Tests contract + mock 8/8
4. Documentation opérateur Cockpit (future)

---

## 13. Cockpit (future — hors Phase C)

Timeline SSE tags :
- `browser.observe.launch`
- `browser.observe.navigate`
- `browser.observe.styles`
- `browser.observe.close`

Panel : durée session, samples count, lien screenshot, bouton « Réutiliser pour Design Extract ».

---

## 14. Ordre d'implémentation Phase C

```
C1. browserPolicy.js + browserHarnessContract.js + tests contract
C2. browserSessionService.js (launch/close, mockable)
C3. browserStyleSampler.js + browserObservationService.js
C4. browserHarnessWorker.js + artefacts
C5. designExtractStyleMerge.js + worker hybrid branch
C6. API /api/browser/observe + job manager (optionnel async)
C7. Tests golden hybrid + doc opérateur
```

Estimation : **1 PR infrastructure** (C1–C4) + **1 PR intégration Extract** (C5–C7).

---

## 15. Non-objectifs Phase C

- Actions utilisateur (clic, formulaire) → Phase D
- Intents chat WEB_* → Phase E
- Crawl multi-pages / SPA routing profond
- Impeccable verify pixel-diff
- Egress public sans revue sécurité

---

## Liens

- [[Design-Extract-Worker]]
- [[Index-Skills-Runtime-2026]]
- [[ADR-20260601-Suite-Design-Nexxus]]
- [[ADR-20260527-Intent-Contract-Registry]]
- `server/src/services/design-extract/designExtractPolicy.js` — egress partagé

---

*Dernière mise à jour : 27/05/2026 — spec Phase C prête à intégrer.*
