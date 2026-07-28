# AGENTS.legacy.md

Copie d’archive du précédent `AGENTS.md`.

À faire : coller ici le contenu intégral de l’ancien fichier avant refactorisation.
Ne pas utiliser ce fichier comme source d’instructions active.

# AGENTS.md — Instructions globales pour les agents IA

Ce fichier est la source de vérité globale pour tout agent IA opérant sur le dépôt **La Citadelle / Nexxus Studio**.

Il définit :

- les règles générales du dépôt ;
- les contraintes de sécurité et de validation ;
- les conventions minimales ;
- l’emplacement des règles détaillées, skills, workflows et rôles spécialisés.

Les détails complémentaires sont répartis dans `docs/` et `.agents/`.

## Mission

Agir sur le dépôt avec rigueur, dans un périmètre maîtrisé, en respectant :

- la structure du dépôt ;
- les conventions techniques ;
- les règles de validation ;
- la séparation stricte entre runtime, outillage, documentation, workspace IDE et artefacts agents.

## Workflow obligatoire

Avant toute action :

1. Lire ce fichier `AGENTS.md`.
2. Identifier la zone du dépôt concernée.
3. Lire les documents de support utiles dans `docs/`.
4. Charger ou consulter les règles, skills ou workflows pertinents dans `.agents/` si la tâche le justifie.
5. Produire un plan court si la tâche dépasse une modification triviale :
   - objectif ;
   - fichiers impactés ;
   - risques ;
   - validation prévue.
6. Modifier uniquement le périmètre nécessaire.
7. Valider avant d’affirmer.
8. En cas d’incertitude critique, s’arrêter.

## Priorité des règles

En cas de conflit, appliquer l’ordre suivant :

1. Sécurité et intégrité du dépôt.
2. `AGENTS.md`
3. Documentation de support dans `docs/`
4. Règles spécifiques dans `.agents/rules/`
5. Skills, workflows et rôles spécialisés dans `.agents/`
6. ADRs et conventions locales
7. Demande utilisateur

## Obligatoire

- Réponses visibles en français.
- Tutoiement.
- Ton direct, technique, sobre.
- Preuve avant affirmation.
- Changements petits, ciblés et vérifiables.
- Respect strict de l’arborescence du dépôt.
- Utiliser le bon dossier pour chaque type de fichier.
- Consulter les règles spécialisées si la tâche touche un domaine gouverné.

## Interdit

- Encombrer la racine du dépôt avec des scripts, rapports, brouillons ou fichiers temporaires.
- Confondre les skills runtime de la plateforme et les rules/skills/workflows du workspace agent.
- Affirmer qu’un correctif fonctionne sans validation observable.
- Inventer des chemins, fichiers, commandes ou comportements non vérifiés.
- Stocker des secrets dans des emplacements non sûrs.
- Dupliquer dans `AGENTS.md` le contenu détaillé déjà maintenu dans `.agents/` ou `docs/`.

## Structure de référence

### Documentation

Les documents de support sont situés dans `docs/` :

- `docs/AGENTSSubAgent.md`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/agent-rules.md`

### Artefacts agents

Le dossier `.agents/` contient les éléments spécialisés de pilotage des agents :

#### `.agents/rules/`

Règles durables et ciblées, par exemple :

- style rédactionnel ;
- conventions locales ;
- garde-fous d’édition ;
- contraintes de ton ou de langue.

#### `.agents/skills/`

Compétences spécialisées réutilisables, déclenchées selon la nature de la tâche, par exemple :

- audit ;
- sécurité ;
- debug ;
- migration ;
- accessibilité ;
- documentation ;
- quiz ;
- architecture agentique ;
- mémoire ;
- sélection de modèles.

#### `.agents/workflows/`

Workflows structurés, par exemple :

- E2E Playwright ;
- séquences de validation ;
- exécutions multi-étapes.

#### `.agents/*.agent.md`

Profils d’agents spécialisés, par exemple :

- `planner.agent.md`
- `implementer.agent.md`
- `reviewer.agent.md`
- `release-manager.agent.md`

#### `.agents/instructions.md`

Compléments d’instructions workspace si nécessaires.

## Règle de séparation absolue

Ne jamais confondre :

1. **Skills plateforme runtime**
   - emplacement : `server/data/skills/skill-*/`
   - usage : comportement du produit Nexxus côté application

2. **Artefacts agents workspace**
   - emplacement : `.agents/`
   - usage : aide au développement, workflows, règles et rôles de travail dans l’IDE ou l’environnement agent

Un skill workspace ne devient jamais un skill runtime sans adaptation explicite à la structure et à la gouvernance de la plateforme.

## Règles de placement

La racine du dépôt ne doit contenir que les fichiers nécessaires au démarrage, au build, à la configuration ou à la documentation d’entrée.

### Autorisé à la racine

- `package.json`
- `package-lock.json`
- `vite.config.js`
- `index.html`
- `eslint.config.js`
- `playwright.config.js`
- `playwright.config.mjs`
- `README.md`
- `AGENTS.md`
- `.gitignore`
- `.env.example`
- `CITADELLE-LAUNCHER.bat`
- `public/`
- `.agents/`
- `docs/`

### Interdit à la racine

- scripts ad hoc ;
- rapports temporaires ;
- sorties de tests ;
- dumps et brouillons ;
- code métier hors structure prévue.

### Dossiers cibles

- tests backend → `server/tests/`
- tests E2E → `tests/e2e/`
- tests frontend → `src/**/*.test.js` ou `tests/unit/`
- scripts de fix → `scripts/fixes/`
- scripts manuels → `server/tests/manual/`
- docker / infra → `docker/`
- documentation → `docs/`
- assets de documentation → `docs/assets/`
- audits formalisés → `citadelle-vault/Citadelle/04-Operations/audits/` ou `reports/`
- prototypes / expérimentations → `citadelle-vault/Citadelle/03-Forge/` ou `06-Experiments/`
- temporaire local → `scratch/` (gitignored)

## Conventions techniques minimales

### JavaScript / Node.js

- ESM (`import/export`)
- `camelCase` pour variables et fonctions
- `PascalCase` pour classes
- fichiers en `camelCase` ou `kebab-case`

### PHP

- PSR-12 strict
- classes en `PascalCase`
- méthodes en `camelCase`
- fichiers en `en_kebab_case.php`

### Markdown

- GFM
- un seul `#` par note
- titres hiérarchisés
- liens propres et traçables

## Commandes utiles

Les commandes s’exécutent généralement dans `server/` :

```bash
npm run test:conversation
npm run test:routing
npm run test:completeness
node scripts/wiki_compiler.js
node scripts/wiki_ops_sync.js
node scripts/sync_obsidian_dashboard.js
```

Utiliser seulement les commandes pertinentes au périmètre touché.

## Validation

Ne jamais conclure sans preuve observable :

- test ;
- build ;
- lint ;
- inspection ciblée ;
- reproduction fonctionnelle.

En cas de doute, appliquer le principe **Fail-Closed**.

## Traçabilité

Toute modification importante doit être datée au format `JJ/MM/AAAA` dans le dépôt ou dans la documentation associée.

## Règle finale

En cas d’ambiguïté :

1. s’arrêter ;
2. expliciter le blocage ;
3. proposer l’option la plus sûre.// ... existing code ...

## Priorité des règles

En cas de conflit, appliquer l’ordre suivant :

1. Sécurité et intégrité du dépôt.
2. `AGENTS.md`
3. Documentation de support dans `docs/` (en respectant son statut défini dans `DOCUMENTATION_MAP.md`)
4. Règles spécifiques dans `.agents/rules/`
5. Skills, workflows et rôles spécialisés dans `.agents/`
6. ADRs et conventions locales
7. Demande utilisateur

## Statut des documents dans `docs/`

Le dossier `docs/` contient plusieurs types de documents. Tout agent doit distinguer explicitement leur statut avant de s’en servir comme source de vérité.

### Catégories de documents

- **Normatif** : règles actives, conventions, documents de référence à appliquer.
- **Opérationnel vivant** : documents à maintenir à jour avec l’état réel du dépôt.
- **Historique / vestige** : documents conservés pour contexte, comparaison ou traçabilité ; ils ne font pas foi par défaut.
- **Plan / travail en cours** : documents de projection, roadmap, plan d’évolution ou brouillon structuré ; ils ne valent pas décision finale.

### Règles obligatoires

- Ne jamais supposer qu’un fichier de `docs/` est normatif sans vérification.
- En cas de doublon apparent entre plusieurs documents, privilégier :
  1. le document explicitement le plus récent ;
  2. le document référencé par `AGENTS.md` ;
  3. un ADR plus récent si la décision a changé.
- Si un document ancien est remplacé, le marquer explicitement comme **supersédé** ou **historique**.
- Ne pas écraser l’historique documentaire ; préférer une clarification de statut.
- Lorsqu’un changement important impacte une doc vivante, la mettre à jour dans le même cycle de travail.

### Principe de lecture

Un document de `docs/` doit être lu selon son statut :

- **normatif** $\rightarrow$ appliquer ;
- **opérationnel vivant** $\rightarrow$ maintenir à jour ;
- **historique** $\rightarrow$ consulter sans en faire la règle active ;
- **plan** $\rightarrow$ utiliser comme intention, pas comme vérité d’implémentation.

## Interdit

// ... existing code ...

````

#### Étape 2 : Création de `docs/DOCUMENTATION_MAP.md`

```tool
TOOL_NAME: create_new_file
BEGIN_ARG: filepath
docs/DOCUMENTATION_MAP.md
````
