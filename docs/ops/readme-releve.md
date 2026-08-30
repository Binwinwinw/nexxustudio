# Relevé factuel — dépôt `nexxustudio`

Source de faits pour le README public (`README.md` à la racine). Pas la vitrine GitHub.  
**Sources :** `package.json` (racine + `server/`), `server/.env.example`, `index.html`, `vite.config.js`, `docs/architecture.md`, arborescence, scripts, code UI/API.  
**Règle :** faits vérifiés uniquement — pas de secrets, pas de marketing.

---

## Sommaire

1. [Nom exact](#1-nom-exact)
2. [Description courte](#2-description-courte)
3. [Stack technique](#3-stack-technique)
4. [Arborescence](#4-arborescence)
5. [Scripts npm](#5-scripts-npm)
6. [Installation locale](#6-installation-locale)
7. [Variables d’environnement](#7-variables-denvironnement)
8. [Déploiement](#8-déploiement)
9. [Fonctionnalités utilisateur](#9-fonctionnalités-utilisateur)
10. [État du projet](#10-état-du-projet)
11. [Tests](#11-tests)
12. [Lint / format](#12-lint--format)
13. [Dépendances majeures](#13-dépendances-majeures)
14. [Visuels](#14-visuels)
15. [À mentionner / à éviter](#15-à-mentionner--à-éviter)
16. [Annexes pour rédaction README](#16-annexes-pour-rédaction-readme)

---

## 1. Nom exact

| Emplacement | Valeur |
|---|---|
| `package.json` (racine) | `"name": "nexxustudio"` |
| `server/package.json` | `"name": "nexxustudio-server"` — description : *Standalone Backend for Nexxus Studio* |
| Titre navigateur (`index.html`) | **La Citadelle** |
| Docs internes | « La Citadelle », « Nexxus Studio », « Nexxus Citadel » / « Nexxus » (voix / agent) |
| Remote Git | `https://github.com/Binwinwinw/nexxustudio.git` |
| Branche observée | `main` |

> **Attention :** nom npm ≠ marque UI. README public → clarifier les deux (produit *La Citadelle*, dépôt *nexxustudio*).

---

## 2. Description courte

Faits issus du code et de `docs/architecture.md` :

- Plateforme **locale-first** d’orchestration d’agents, knowledge et assistance technique.
- **UI React** : chat, historique, cockpit / télémétrie, panneaux gouvernance / sécurité / forge.
- **Backend Express** : pipeline agent, sessions, health, forge, knowledge, auth, télémétrie.
- **LLM** via Ollama local (+ satellites Python optionnels : AirLLM, creative, OCR, Chroma).
- **Cible implicite** : opérateur / développeur sur machine locale (scripts Windows, launcher `.bat`). Aucun parcours SaaS multi-tenant documenté dans le repo.
- **Problème adressé** : assistant technique local gouverné (routage, policies, sécurité, observabilité) — pas un template React générique.

---

## 3. Stack technique

| Couche | Techno |
|---|---|
| Front | React **19**, Vite **8**, JS/JSX (pas de `tsconfig`) |
| CSS | Tailwind CSS **4** (`@tailwindcss/vite`) |
| Libs front | `lucide-react`, `react-markdown` + `remark-gfm`, `mermaid`, `recharts` |
| Lint | ESLint **9** (flat config) + React Hooks / Refresh |
| Backend | Node.js, Express **4**, ESM (`"type": "module"`) |
| Libs back notables | `dotenv`, `helmet`, `cors`, `multer`, `mysql2`, `jsonwebtoken`, `bcryptjs`, `chromadb`, `cheerio`, `axios`, `sharp`, `tesseract.js`, `pdf-parse`, `ajv`, rate-limit, cookie-parser |
| LLM | Ollama (`OLLAMA_HOST`) |
| Vecteurs | Chroma (port **8008** local / compose) |
| OCR | micro-service Python FastAPI/uvicorn (`ocr-service/`) |
| Autres process | `server/airllm`, `server/creative` (Python) |
| E2E | Playwright |
| Tests serveur | `node --test` + scripts de régression |
| OS scripts | PowerShell / `.bat` (Windows) au démarrage racine |

**Absents :** Prettier, champ `"engines"` Node, React Compiler (mentionné seulement dans le README template Vite).

---

## 4. Arborescence

```text
nexxustudio/
├── src/                      # Front React (App, components, views, services, config)
├── public/                   # favicon.svg, icons.svg
├── shared/                   # modules partagés front/back (ex. generatorFirstPolicy)
├── server/                   # Backend Express + agent pipeline
│   ├── index.js
│   ├── .env.example
│   ├── src/                  # agent | forge | security | services | routes | …
│   ├── tests/                # ~310 fichiers *.test.js
│   ├── airllm/               # service Python
│   ├── creative/             # service Python
│   ├── data/                 # données runtime (chroma, etc.)
│   └── public/analytics/
├── ocr-service/              # OCR HTTP + Docker
├── docker/                   # compose Chroma + AirLLM
├── docs/                     # architecture, agents, testing, roadmap…
│   └── assets/               # AI_ORCHESTRATION.png
├── tests/e2e/                # Playwright (2 specs observés)
├── projects/                 # artefacts / projets générés ou démos
├── citadelle-vault/          # vault Obsidian / gouvernance
├── scripts/                  # cleanup ports, purge, etc.
├── .agents/                  # skills / workflows agents IDE
├── CITADELLE-LAUNCHER.bat
├── package.json              # orchestrateur start + Vite
├── vite.config.js
├── playwright.config.js
└── README.md                 # vitrine publique (produit La Citadelle)
```

Pas de dossier `pages/` : routing par vues internes (pas Next / React Router pages).

---

## 5. Scripts npm

### Racine (`package.json`)

| Script | Rôle |
|---|---|
| `dev` | Vite (port **5173**, `strictPort`) |
| `server` | `cd server && npm run dev` (nodemon) |
| `airllm` / `creative` / `chroma` | Services satellites |
| `prestart` | `scripts/cleanup-ports.ps1` |
| `start` | Alias → `start:balanced` |
| `start:fast` / `start:balanced` / `start:demo` | `concurrently` : server + Vite + airllm + creative + chroma (+ profils Ollama) |
| `start:docker` | server + Vite + creative (sans airllm/chroma npm) |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `lint` | `eslint .` |
| `test:stream` | Petits tests front Node |
| `test:e2e` / `headed` / `debug` / `report` | Playwright |
| `test:e2e:runtime` | Spec runtime chunks |
| `bootstrap` | Bootstrap Citadelle |
| `citadel:smoke` / `audit` / `bench` / `sync` | Ops Citadelle |
| `vault:audit`, `quality:gate`, `security:*`, rapports daily | Ops / qualité |
| `purge:*` | Nettoyage dépôt (PowerShell) |

### Serveur (`server/package.json`)

| Famille | Scripts |
|---|---|
| Runtime | `start`, `dev` |
| Tests | `test:conversation`, `test:code-delivery`, `test:stability`, `test:routing`, `test:golden`, `test:security`, `test:tools-core`, `test:benchmarks`, `test:completeness`, `test:skills`… |
| Ops | `quality:gate`, `vault:*`, `bootstrap`, rapports daily, triage/export |

---

## 6. Installation locale

Procédure alignée sur `README.md` (déduite du repo) :

1. **Prérequis implicites** : Node + npm ; Ollama joignable ; Python si airllm / creative / ocr ; MySQL optionnel ; Docker si compose OCR / Chroma / AirLLM.
2. `npm install` à la racine.
3. `cd server && npm install`.
4. Copier `server/.env.example` → `server/.env` et renseigner les variables **obligatoires** (sinon exit au boot via `envValidator.js`).
5. Lancer Ollama ; pull des modèles vision/OCR **si** ces capacités sont activées (commentaires dans `.env.example`).
6. Démarrage typique Windows : `npm run start`.  
   Alternative : `CITADELLE-LAUNCHER.bat` (install manquante + Ollama + server + Vite + airllm) — **chemins Ollama hardcodés machine auteur, non portables**.
7. Front : `http://localhost:5173` — API défaut : `http://localhost:3000`.
8. Optionnel : `npm run bootstrap` / `node server/scripts/bootstrap-citadelle.mjs`.

---

## 7. Variables d’environnement

### Obligatoires serveur

Fichier : `server/.env` (modèle : `server/.env.example`). Validées par `envValidator.js` (fail-closed).

| Variable | Contrainte |
|---|---|
| `JWT_SECRET` | Requis |
| `INTERNAL_API_TOKEN` | Requis |
| `LOG_ENCRYPTION_KEY` | **32 octets** après décodage hex (64 chars) ou base64 |

### Documentées / usuelles

| Variable | Notes |
|---|---|
| `ADMIN_PASSWORD` | Auth console admin |
| `PORT`, `NODE_ENV`, `CORS_ORIGINS` | Serveur (PORT défaut `3000`) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Optionnel en local |
| `ALLOW_LEGACY_PLAINTEXT_LOGS` | Logs |
| `OLLAMA_HOST` | LLM local |
| `NEXXUS_VISION_OCR`, modèles vision/OCR, `OCR_SERVICE_URL`… | Vision / OCR (optionnel) |
| `NEXXUS_LOW_TOKEN_MODE` | Commenté dans l’exemple |
| `HF_TOKEN` | Compose AirLLM (optionnel) |

### Front Vite

| Variable | Défaut dans le code |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000` |

Pas de `.env.example` racine pour le front.

### Ignore git

Ignorés : `.env`, `server/.env`, variantes locales.  
Autorisé : `!.env.example`.

---

## 8. Déploiement

**Présent dans le repo :**

- `docker/knowledge_hub_docker-compose.yml` — Chroma + AirLLM (bind `127.0.0.1`)
- `ocr-service/Dockerfile` (+ GPU), `server/airllm/Dockerfile`
- Script `start:docker` (process locaux + profil Ollama)

**Absent / non prouvé :**

- Pipeline CI GitHub Actions de deploy
- Config Hostinger / Vercel / Nginx prod
- Dockerfile app full-stack unique
- Fichier `LICENSE`

> Le chemin disque `Hostinger/public_html` est un environnement local — **pas** une preuve de deploy Hostinger versionné.

---

## 9. Fonctionnalités utilisateur

Navigation (`citadelleNav.js` / `citadelleViews.js`) :

| Zone | Contenu |
|---|---|
| Communication | Chat (streaming, sessions), Historique |
| Opérations | Cockpit (télémétrie / warmup / traces), Télémétrie |
| Réglages | Gouvernance, Triage d’intent, Audits & télémétrie, Hooks, Audit d’impact, Artefacts, Forge async |
| Autres vues | Analyse documentaire (`DocumentAnalysisView.jsx`), Markdown pédagogique, Mermaid, dashboards |

**Backend (échantillon routes) :** auth login, health/ready, pipeline, forge, production jobs/SSE, knowledge, vision, sessions, governance, security telemetry, workspaces, analytics.

---

## 10. État du projet

| Indice | Valeur |
|---|---|
| Version racine | `0.0.0` + `"private": true` |
| Version serveur | `1.0.0` |
| README | Vitrine publique — `README.md` à la racine |
| Docs | Architecture opérationnelle ; roadmap phases 2–3 « terminées », phase 4 « en cours » ; open-source listé « prochainement » |
| Tests | Suite serveur large + E2E Playwright + smoke / quality gates |

**Formulation prudente pour un README :** application locale en développement actif / usage opérateur.  
Éviter sans nuance : « MVP », « production », « open-source mature », « SaaS grand public ».

---

## 11. Tests

| Zone | Emplacement / commande |
|---|---|
| Serveur | `server/tests/` (~310 `*.test.js`) + scripts npm dédiés |
| Front | `src/**/*.test.js`, `npm run test:stream` |
| E2E | `tests/e2e/` (2 specs), `npm run test:e2e` |
| Doc stratégie | `docs/testing.md` |

Pas de script unique `test` à la racine qui lance tout.

---

## 12. Lint / format

| Outil | Statut |
|---|---|
| ESLint | Présent — `npm run lint` (`eslint.config.js`, front + server) |
| Prettier | Absent |
| TypeScript | Absent |

---

## 13. Dépendances majeures

| Couche | À citer |
|---|---|
| Front | React 19, Vite 8, Tailwind 4, lucide-react, react-markdown, mermaid, recharts, Playwright, ESLint |
| Back | Express, Ollama, ChromaDB, MySQL2 (optionnel), JWT/bcrypt, multer, helmet, sharp / tesseract / pdf-parse, cheerio |
| Satellites | Python AirLLM / creative / OCR |

---

## 14. Visuels

| Fichier | Présent |
|---|---|
| `public/favicon.svg` | Oui |
| `public/icons.svg` | Oui |
| `docs/assets/AI_ORCHESTRATION.png` | Oui |
| Logo produit / captures UI pour README | Non trouvés |
| `LICENSE` | Non |

---

## 15. À mentionner / à éviter

### Mentionner (prouvé)

- Monorepo front Vite + backend Express
- Local-first + Ollama
- Nom produit **La Citadelle**
- Secrets obligatoires au démarrage
- Scripts Windows
- Tests nombreux côté `server/`
- Vault / docs internes

### Éviter faute de preuve

- SaaS cloud
- Deploy Hostinger / Vercel
- Licence open-source claire
- Scores de maturité % des docs rhétoriques
- « Production ready » absolu
- Décrire le produit comme « React + Vite » seul
- Chemins machine de `CITADELLE-LAUNCHER.bat`
- Secrets
- Lister tous les skills `.agents` comme features produit

---

## 16. Annexes pour rédaction README

### Identité package racine

```text
name: nexxustudio
private: true
version: 0.0.0
type: module
```

Deps utiles : react / react-dom, Vite, Tailwind, mermaid, recharts, markdown…  
DevDeps utiles : eslint, playwright, concurrently, `@vitejs/plugin-react`.

### Liste compacte des scripts

**Racine :**  
`dev`, `server`, `airllm`, `creative`, `chroma`, `prestart`, `purge:*`, `start`, `start:fast|balanced|demo|docker`, `build`, `lint`, `test:stream`, `test:e2e*`, `preview`, `citadel:*`, `bootstrap`, `vault:audit`, `security:*`, `quality:gate`, `conversation|memory|ops:daily-report`.

**Serveur :**  
`start`, `dev`, `test:conversation|code-delivery|stability|skills|benchmarks|completeness|routing|golden|security|tools-core`, triage/export, vault/ops/quality/bootstrap/reports.

### Variables attendues (rappel)

- **Obligatoires :** `JWT_SECRET`, `INTERNAL_API_TOKEN`, `LOG_ENCRYPTION_KEY` (32 octets)
- **Usuelles :** admin, PORT/CORS, DB optionnelle, OLLAMA, vision/OCR, `VITE_API_BASE_URL` (front)

### Résumé app (≤ 10 lignes, factuel)

Nexxus Studio / La Citadelle est une app **locale** : UI React (Vite) + API Express.  
Elle orchestre un agent conversationnel branché sur **Ollama**, avec policies de routage, sessions, forge/artefacts, dashboards d’ops/sécurité, et services optionnels (Chroma, AirLLM, creative, OCR).  
Le README public (`README.md`) décrit le produit ; ce relevé reste la table de faits.  
Config sensible via `server/.env` (fail-closed).  
Démarrage typique Windows : `npm install` (racine + server), renseigner `.env`, puis `npm run start`.  
Tests : nombreux côté `server/tests`, E2E Playwright, lint ESLint — pas de Prettier ni TypeScript.
)
