# AGENTS.md – Documentation d'Orchestration et Instructions pour les Agents IA

Ce document sert de spécification technique de contexte, de contraintes et de préférences pour tout agent d'Intelligence Artificielle (Jules, Cursor, Claude Code, Copilot, Nexxus lui-même, etc.) opérant sur le dépôt de **La Citadelle / Nexxus Studio**.

---

## 📌 1. Vue d'ensemble du Projet & Philosophie

La Citadelle est un système multi-agents IA **local-first** et souverain conçu pour l'orchestration de connaissances hautement sécurisées, opérant de manière autonome et indépendante de dépendances API externes critiques.

### Doctrine d'Orchestration : Lazy-Loading (1-2 Experts Actifs Max)
Contrairement aux architectures multi-agents denses et parallèles (qui, selon les recherches empiriques de Google menées sur plus de 180 configurations d'agents, dégradent les performances de **70%** sur les tâches séquentielles et multiplient les erreurs par **17x** en raison de l'effet "téléphone arabe" et de la dérive sémantique), La Citadelle applique une **doctrine stricte de parcimonie et de centralisation** :
- **Classification d'Intention & Routage Statique BM25** : Les intentions sont classifiées à la volée.
- **Lazy-Loading Actif** : Un maximum de **1 à 2 experts** (ex. `expert_mentor`) est réveillé ou instancié à tout moment du cycle d'inférence pour résoudre une tâche séquentielle.
- **Orchestration Silencieuse** : Les experts lourds réfléchissent en silence sans polluer le contexte de réponse utilisateur. Seule la voix finale régit le rendu final.

---

## 📂 2. Structure & Taxonomie Souveraine v4.5

Le coffre Obsidian (**citadelle-vault/Citadelle**) utilise des **piliers racine** (`00-Gouvernance/`, `01-Architecture/`, `02-Operations/`, `03-Connaissances/`, `99-Zone-Exclue/`). Les noms v4.5 ci-dessous sont des **segments**, pas des dossiers à la racine. Ne pas créer `02-Architecture/`, `00-ADRs/` ni `01-Modules/` à la racine.

- **ADR actifs** : `01-Architecture/02-Architecture/adr/` — source vault des décisions d'architecture (pas le graphe Graphify, pas `docs/`).
- **`00-Foundation/`** (disque : `00-Gouvernance/00-Foundation/`) : fondations épistémiques et gouvernance vault.
- **`01-Strategy/`** (disque : `02-Operations/01-Strategy/`) : objectifs à long terme, gouvernance et scorecards.
- **`02-Architecture/`** (disque : `01-Architecture/02-Architecture/`) :
  - `adr/` : ADR actifs.
  - `modules/` : spécifications de composants.
  - `diagrams/` : représentations graphiques.
- **`03-Forge/`** (disque : `01-Architecture/03-Forge/`) : prototypage et maturation de code.
- **`04-Operations/`** (disque : `02-Operations/04-Operations/`) :
  - `audits/` : rapports d'intégrité et diagnostics.
  - `reports/` : comptes-rendus opérationnels.
  - `procedures/` : playbooks.
- **`05-Knowledge/`** (disque : `03-Connaissances/05-Knowledge/`) :
  - `heritage/` : patrimoine consolidé.
- **`06-Experiments/`** (disque : `99-Zone-Exclue/06-Experiments/`) : sandbox.
- **`07-Archive/`** (disque : `99-Zone-Exclue/07-Archive/legacy-v4/`) : miroir v4 figé — ne pas éditer.
- WikiLinks `[[02-Architecture/adr/Note]]` : suffixe unique, pas un chemin racine.
- **`_assets/`**, **`_templates/`** : pièces jointes et modèles — ne pas déplacer dans ce lot.

Carte des chemins : [[00-Foundation/VAULT-GOVERNANCE|VAULT-GOVERNANCE]].

---

## 🔗 3. Conventions Techniques & Formats de Code

### 📝 Formats de Fichiers & Syntaxes de Style
- **JavaScript / Node.js (Backend)** : Imports standard ESM (`import/export`), typage implicite fort, nommage en `camelCase` pour les variables/fonctions et en `PascalCase` pour les classes. Fichiers nommés en `camelCase` ou `kebab-case` (ex: `ollamaStreamProcessor.js`).
- **PHP** : Respect strict du standard de style **PSR-12**. Classes en `PascalCase`, méthodes en `camelCase`. Fichiers nommés en `en_kebab_case.php`.
- **Markdown** : GitHub Flavored Markdown (GFM), titres hiérarchisés `H1` à `H3` (maximum un seul titre `#` par note), citations obligatoires et traçables de sources sous forme de liens.
- **Obsidian WikiLinks** : Les liens internes doivent être saisis sous la forme `[[Nom de la Note]]` ou de liens relatifs Markdown propres `[Texte](chemin_relatif.md)` respectant la taxonomie v4.5.

---

## 🛠️ 4. Commandes Utiles de Build, Test & Sync

Les commandes s'exécutent généralement dans le dossier `server/` :

```bash
# Lancer les tests unitaires et d'intégration de conversation (100% requis avant commit)
npm run test:conversation

# Exécuter les tests de régression de routage sémantique
npm run test:routing

# Lancer le validateur de complétude des réponses LLM
npm run test:completeness

# Compiler les index Wiki du Vault (ADRs et Modules)
node scripts/wiki_compiler.js

# Lancer la synchronisation des ADRs dans le système de connaissances RAG
node scripts/wiki_ops_sync.js

# Mettre à jour le dashboard et les statistiques du graphe Obsidian
node scripts/sync_obsidian_dashboard.js
```

---

## 🛡️ 5. Instructions de Sécurité & Pipeline Épistémique v4.6

- **Doctrine du Fail-Closed par Défaut** : En cas d'ambiguïté ou d'incertitude critique lors de la génération ou de la validation de code/données, l'agent doit immédiatement lever une exception contrôlée ou basculer en mode de secours statique plutôt que d'émettre une hypothèse ou de risquer une régression.
- **Pipeline Épistémique** : Exiger une validation à chaque étape (Proof-before-Assertion). Le processus de réflexion doit être documenté, traçable et exempt d'hallucinations factuelles.
- **Sécurité d'Environnement** : Ne jamais stocker de jetons sensibles ou utiliser de stockage permanent non contrôlé (`localStorage` ou cookies non sécurisés) dans les bacs à sable d'iframe.

---

## 👥 6. Préférences de l'Équipe & Ligne Éditoriale

- **Langue** : Toutes les documentations, notes du Journal de Bord et réponses finales doivent être rédigées en **français**.
- **Ton de l'Agent (Instances Locales uniquement)** : Souverain, direct, hautement technique, exempt de "remplissage marketing" ou d'enthousiasme robotique. L'agent parle au nom de **NEXXUS**, le gardien souverain de La Citadelle.
*(Note : Les assistants IA externes comme Antigravity sont exemptés de cette règle et doivent conserver leur identité propre).*
- **Traçabilité** : Chaque modification importante ou consolidation doit être consignée avec horodatage et date claire au format `JJ/MM/AAAA` (ex: `17/05/2026`).
