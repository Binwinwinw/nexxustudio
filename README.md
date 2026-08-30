# Nexxus Studio — La Citadelle

Monorepo local-first pour orchestrer un assistant technique gouverné, avec une interface React/Vite et un backend Express branché sur Ollama.

Le dépôt **`nexxustudio`** correspond au repo GitHub, tandis que **La Citadelle** est le nom visible côté produit dans l’interface.

## Aperçu

Nexxus Studio regroupe une UI opérateur, un pipeline d’agents, des couches de gouvernance/sécurité, des fonctions de knowledge et plusieurs services optionnels autour d’un usage principalement local.

Le front fournit notamment du chat, de l’historique, des vues cockpit/télémétrie et plusieurs panneaux d’administration. Le backend expose des routes pour les sessions, la santé, la forge, la knowledge, l’authentification, la gouvernance, la sécurité et l’observabilité.

## Stack technique

### Frontend
- React 19
- Vite 8
- JavaScript / JSX
- Tailwind CSS 4
- `react-markdown` + `remark-gfm`
- `lucide-react`
- `mermaid`
- `recharts`

### Backend
- Node.js + Express 4
- ESM (`"type": "module"`)
- `dotenv`, `helmet`, `cors`, `multer`
- `mysql2` (optionnel selon usage local)
- `jsonwebtoken`, `bcryptjs`
- `chromadb`, `axios`, `cheerio`
- `sharp`, `tesseract.js`, `pdf-parse`
- `ajv` et outils de sécurité / validation

### Services et tooling
- Ollama (LLM local)
- Chroma
- Services Python optionnels : AirLLM, creative, OCR
- ESLint 9
- Playwright
- `node --test` côté serveur

## Structure du dépôt

```text
nexxustudio/
├── src/                  # Front React
├── public/               # Assets publics
├── shared/               # Modules partagés
├── server/               # Backend Express + pipeline agent
├── ocr-service/          # Service OCR HTTP + Docker
├── docker/               # Compose et services locaux
├── docs/                 # Architecture, testing, roadmap, assets
├── tests/e2e/            # Scénarios Playwright
├── projects/             # Artefacts / démos
├── citadelle-vault/      # Vault interne
├── scripts/              # Scripts d’exploitation et nettoyage
├── .agents/              # Skills / workflows IDE
├── CITADELLE-LAUNCHER.bat
├── package.json
├── vite.config.js
├── playwright.config.js
└── README.md
```

## Fonctionnalités visibles

### Interface
- Chat avec streaming
- Historique et sessions
- Cockpit / télémétrie / warmup / traces
- Gouvernance et triage d’intent
- Audits, hooks, artefacts, forge async
- Vues complémentaires comme l’analyse documentaire, le rendu Markdown pédagogique, Mermaid et certains dashboards

### API et orchestration
- Authentification
- Health / ready checks
- Pipeline agent
- Forge et jobs de production via SSE
- Knowledge et vision
- Sessions
- Gouvernance
- Security telemetry
- Workspaces et analytics

## Prérequis

Avant de lancer le projet localement, prévoir selon le profil d’usage :
- Node.js et npm
- Ollama accessible localement
- Python pour les services optionnels (`airllm`, `creative`, `ocr-service`)
- Docker si usage des services conteneurisés
- MySQL uniquement si votre usage local en a besoin

## Installation locale

### 1. Installer les dépendances

```bash
npm install
cd server && npm install
```

### 2. Configurer l’environnement serveur

Créer un fichier `server/.env` à partir de `server/.env.example`.

Variables obligatoires au démarrage :
- `JWT_SECRET`
- `INTERNAL_API_TOKEN`
- `LOG_ENCRYPTION_KEY` (32 octets après décodage)

Variables fréquentes selon le setup :
- `ADMIN_PASSWORD`
- `PORT`
- `NODE_ENV`
- `CORS_ORIGINS`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `OLLAMA_HOST`
- variables vision / OCR comme `OCR_SERVICE_URL`

Côté front, `VITE_API_BASE_URL` pointe par défaut vers `http://localhost:3000`.

### 3. Lancer les services

Démarrage typique :

```bash
npm run start
```

Autres variantes disponibles :
- `npm run start:fast`
- `npm run start:balanced`
- `npm run start:demo`
- `npm run start:docker`

Le front démarre sur `http://localhost:5173` et l’API sur `http://localhost:3000`.

## Scripts utiles

### Racine
- `npm run dev` — lance Vite
- `npm run server` — lance le backend en mode dev
- `npm run build` — build front
- `npm run preview` — preview Vite
- `npm run lint` — exécute ESLint
- `npm run test:stream` — tests front ciblés
- `npm run test:e2e` — E2E Playwright
- `npm run bootstrap` — bootstrap Citadelle

Le dépôt contient aussi plusieurs scripts d’exploitation autour de `citadel:*`, `security:*`, `vault:*`, `quality:gate`, `purge:*` et des profils de démarrage multi-process.

### Serveur
Dans `server/package.json`, on trouve notamment :
- `npm run dev`
- `npm run start`
- des suites ciblées comme `test:routing`, `test:security`, `test:golden`, `test:skills`, `test:stability`, `test:completeness`, `test:tools-core`, etc.

## Tests et qualité

Le projet dispose d’une base de tests importante côté serveur, de quelques tests front ciblés et d’un socle E2E Playwright.

- Serveur : `server/tests/`
- Front : `src/**/*.test.js`
- E2E : `tests/e2e/`
- Lint : `npm run lint`

À noter :
- pas de script racine unique `npm test` pour tout lancer ;
- Prettier n’est pas présent ;
- TypeScript n’est pas utilisé dans ce dépôt.

## Déploiement et services optionnels

Le repo contient des éléments Docker pour certains services locaux, notamment Chroma, AirLLM et l’OCR.

Présent dans le dépôt :
- `docker/knowledge_hub_docker-compose.yml`
- `ocr-service/Dockerfile`
- `server/airllm/Dockerfile`
- script `start:docker`

Non documenté ou non prouvé dans le dépôt :
- pipeline CI/CD de déploiement
- configuration de production Vercel / Hostinger / Nginx
- Dockerfile full-stack unique
- licence open-source explicite

## Visuels et documentation

Le dépôt contient déjà quelques assets et documents internes utiles :
- `public/favicon.svg`
- `public/icons.svg`
- `docs/assets/AI_ORCHESTRATION.png`
- `docs/architecture.md`
- `docs/testing.md`
- relevé factuel (tables, scripts, variables) : [`docs/ops/readme-releve.md`](docs/ops/readme-releve.md)

Aucun logo produit clairement prêt pour le README ni capture d’écran UI dédiée n’a été identifié.

## Positionnement du dépôt

Ce dépôt ne correspond pas à un simple starter React + Vite. Il décrit une application locale en développement actif, pensée pour l’exploitation d’un assistant technique gouverné, avec routage, observabilité, sécurité, knowledge et services satellites.

État du projet : **local-first** et **en développement actif**. Pas de maturité SaaS, de statut « production-ready » absolu, ni de mode de déploiement public non démontré.
