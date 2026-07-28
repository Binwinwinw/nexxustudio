# Skills MonCoachScolaire

Ce fichier indexe tous les skills disponibles dans `.agents/skills/`.

## Skills disponibles

### `admin-skill`

Dossier: `.agents/skills/admin-skill/`
Usage: Gestion des comptes administrateurs, suivi des logs (`adminlogs`), scripts de maintenance et audits de sécurité.

### `audit-repo`

Dossier: `.agents/skills/audit-repo/`
Usage: Audit structurel et qualitatif du repo MonCoachScolaire. Vérifie la cohérence des contextes, instructions, skills, prompts, agents et conventions de patch avant implémentation.

### `data-import-export-skill`

Dossier: `.agents/skills/data-import-export-skill/`
Usage: Automatisation de l'import/export d'exercices et quiz (JSON, SQL, CSV) avec validation de schéma, logs et rollback sécurisé.

### `debug`

Dossier: `.agents/skills/debug/`
Usage: Génère un script CLI de debug d'endpoint API (status HTTP, extrait brut, vérification d'un champ cible).

### `debug-skill`

Dossier: `.agents/skills/debug-skill/`
Usage: Inspection approfondie des endpoints API (status HTTP, RAW, validation de champs critiques) via scripts CLI PHP/Node.

### `doc-refactor-governance`

Dossier: `.agents/skills/doc-refactor-governance/`
Usage: Refactorisation gouvernée des gros fichiers documentaires (charte courte, archive complète, liens croisés, datation), sans perte d'information.

### `exercises-skill`

Dossier: `.agents/skills/exercises-skill/`
Usage: Automatise l'analyse, la migration, l'enrichissement et la validation des exercices MonCoachScolaire. Workflows complets sur les exercices (import, export, déduplication, audit, normalisation, validation qualité).

### `maintenance-skill`

Dossier: `.agents/skills/maintenance-skill/`
Usage: Procédures et scripts de maintenance préventive (backup, nettoyage, optimisation) et corrective.

### `memory-session-skill`

Dossier: `.agents/skills/memory-session-skill/`
Usage: Continuité inter-session via `.memory/`. Relit les règles persistantes au démarrage et consigne les nouvelles instructions, préférences, décisions et quirks en fin de tâche.

### `migration-skill`

Dossier: `.agents/skills/migration-skill/`
Usage: Automatise la migration, la synchronisation et la gestion des schémas de base de données et d’exercices. Exécute des migrations SQL/PHP, synchronise les environnements, génère la documentation de migration et valide la cohérence des données.

### `php-patch`

Dossier: `.agents/skills/php-patch/`
Usage: Génère un patch minimal PHP pour MonCoachScolaire (PSR-12, PDO sécurisé, variables globales, htmlspecialchars). Corrige un bug PHP, ajoute une fonctionnalité dans src/pages/ ou src/api/, ou sécurise une entrée utilisateur.

### `quiz-generator`

Dossier: `.agents/skills/quiz-generator/`
Usage: Crée ou corrige un script Python generate\_\_.py pour MonCoachScolaire. Génère de nouveaux quiz diagnostiques, corrige un schéma JSON non conforme, ou normalise un script legacy.

### `quiz-generator-skill`

Dossier: `.agents/skills/quiz-generator-skill/`
Usage: Automatise la génération, l’enrichissement, la validation et la maintenance des quiz diagnostiques MonCoachScolaire. Workflows complets sur les quiz (génération, validation, enrichissement, audit qualité, harmonisation).

### `quiz-generator-workflow`

Dossier: `.agents/skills/quiz-generator-workflow/`
Usage: Définit le workflow, la structure et les étapes de validation d’un script Python `generate_<matiere>_<niveau>.py` pour MonCoachScolaire.

### `sql-migration`

Dossier: `.agents/skills/sql-migration/`
Usage: Génère un script SQL MySQL sûr, rejouable et compatible phpMyAdmin. Ajoute des colonnes, crée des index, modifie des structures de tables, ou écrit des triggers. Jamais de renumérotation PK référencée.

### `ui-ux-pro-max-skill`

Dossier: `.agents/skills/ui-ux-pro-max-skill/`
Usage: Guidelines UI/UX avancées, accessibilité (WCAG), design system, et référentiels de stacks front modernes.

### `webapp-testing`

Dossier: `.agents/skills/webapp-testing/`
Usage: Exécute et écrit des tests Playwright E2E pour MonCoachScolaire. Valide l'affichage d'exercices, teste un formulaire, vérifie la navigation, ou écrit un smoke test après un patch CSS/JS/PHP.

### `webapp-testing-skill`

Dossier: `.agents/skills/webapp-testing-skill/`
Usage: Automatise l’exécution et la génération de tests E2E Playwright pour MonCoachScolaire. Lancement de tests, génération de specs, validation d’affichage, navigation, formulaires et workflows critiques.

## Règles de sélection rapide

- Correction endpoint/API : `debug` puis `php-patch` si correctif nécessaire
- Patch PHP : `php-patch`
- Migration base de données : `sql-migration`
- Génération ou normalisation quiz : `quiz-generator` ou `quiz-generator-skill`
- Validation front/parcours utilisateur : `webapp-testing` ou `webapp-testing-skill`
- Audit global et hygiène repo : `audit-repo`

## Note

Si plusieurs domaines se chevauchent, combiner les skills dans cet ordre :

- `audit-repo` (cadre)
- skill métier principal (`php-patch`, `sql-migration`, `quiz-generator`, etc.)
- `webapp-testing` ou `webapp-testing-skill` (validation)

## Orchestration Agents V2

Chaîne recommandée pour les demandes complexes :

- `planner` → `implementer` → `reviewer` → `release-manager`

Principe :

- chaque agent a un rôle unique
- restrictions d'outils explicites dans chaque `.agent.md`
- handoffs non circulaires pour limiter les ambiguïtés

## Workflow Quiz Generator (opérationnel)

Commande type pour un nouveau script :

1. Copier `dev/tools/quiz/generate_0template.py` vers `generate_<matiere>_<niveau>.py`
2. Exécuter `python dev/tools/quiz/validate_generator_pattern.py --file dev/tools/quiz/generate_<matiere>_<niveau>.py`
3. Exécuter `python dev/tools/quiz/validate_generator_pattern.py` (famille complète)

Note 14/03/2026 :

- Le template canonique a été renommé de `generate_template.py` vers `generate_0template.py` pour rester en tête de liste.

État migration au 12/03/2026 :

- `generate_hg_1ere.py`, `generate_pc_1ere.py`, `generate_philo_1ere.py` alignés sur le pattern
- baseline complète : `failed_checks: 0`
