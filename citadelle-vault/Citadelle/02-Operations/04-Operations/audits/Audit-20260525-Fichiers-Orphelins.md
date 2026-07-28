# Audit Système : Fichiers Orphelins & Dette Structurelle

*Date : 25/05/2026*
*Cible : `D:\Hostinger\public_html\nexxustudio\server`*

Un scan exhaustif de l'arbre des dépendances internes du backend a été réalisé via un script d'analyse heuristique pour identifier les fichiers `.js` qui ne sont plus importés ni référencés nulle part dans le code, ainsi que les anomalies de placement.

## 1. Fichiers Orphelins (Code Mort)
Les fichiers suivants existent dans le répertoire `src` mais ne sont **jamais importés ni utilisés** par l'application (aucune référence `import` ou `require`). Ils constituent de la dette technique ou des reliquats d'anciennes architectures :

- **Sauvegardes abandonnées :**
  - `server/src/agent/knowledge/knowledgeRouterbak-24-04-26.js` (Fichier de backup inutile en prod).

- **Services & Outils dépréciés :**
  - `server/src/services/memoryConsolidationService.js` (Le service semble avoir été remplacé ou retiré du pipeline principal, mais le fichier traîne toujours).
  - `server/src/agent/skills/blueprintGenerator.js` (Compétence non branchée sur le registre d'outils).
  - `server/src/agent/normalizers/evidenceNormalizer.js` (Inutilisé dans les flux de normalisation actuels).

- **Prompts & Contrats non rattachés :**
  - `server/src/agent/contracts/voxContract.js`
  - `server/src/agent/prompts/handoffTemplate.js`
  - `server/src/agent/prompts/socialPrompt.js`
  - `server/src/agent/utils/intentGuards.js`

- **Fichiers racines non exécutés :**
  - `server/indexWorkspace.js`

> [!WARNING] 
> Ces fichiers "zombies" créent du bruit pour l'indexeur vectoriel et les analyses statiques. Ils devraient être supprimés (après vérification rapide) ou archivés dans `_templates/` ou `07-Archive/` du Vault s'ils ont une valeur documentaire.

---

## 2. Anomalies de Placement
- L'agent `routerAgent.js` se trouve dans `server/src/agent/agents/routerAgent.js`. Bien que ce soit un agent, son nom prête à confusion avec les middlewares Express (souvent cherchés par regex).
- Une multitude de tests unitaires "volants" traînent à la racine du dossier `server/` au lieu d'être dans un dossier `tests/` dédié :
  - `server/test_granite.js`
  - `server/test_null.js`
  - `server/test_stream.js`

---

## 3. L'Inflation du Dossier Scratch
Le dossier `server/scratch/` (qui sert normalement d'espace de prototypage temporaire) est devenu un dépotoir contenant près de **45 scripts non structurés**.
S'il est normal qu'un dossier `scratch` ne soit pas branché au reste de l'application, l'accumulation de ces fichiers révèle que l'espace de "brouillon" déborde.

**Quelques exemples notables qui devraient être soit intégrés dans `scripts/`, soit jetés :**
- `bench_nucleus.js`
- `citadel_regression_test.js`
- `industrial_stress_test.js`
- `verify_sovereign.js`
- `verify_persistence.js`
- `test_rag_router.js`

> [!TIP]
> **Recommandation Opérationnelle** :
> - Supprimer tous les fichiers orphelins de la section 1.
> - Déplacer les fichiers `test_*.js` de la racine vers un vrai dossier de tests.
> - Faire un nettoyage de printemps massif dans `server/scratch/` (effacer les brouillons jetables et ranger les scripts de test système dans `server/scripts/` ou `reliability_tests/`).
