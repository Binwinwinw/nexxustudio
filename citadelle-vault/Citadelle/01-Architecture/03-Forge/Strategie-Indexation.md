# 🧬 Stratégie d'Indexation : Forge & Audit v3.1

L'Audit d'Impact de La Citadelle repose sur une double lecture de votre patrimoine technique. Si l'un des deux piliers est absent, l'audit est incomplet ou peut échouer.

## 1. La Double Hélice (Hybride)
Pour qu'un projet (comme `lacitadelle-ide`) soit "Forge-Ready", il doit être indexé selon deux axes :

### A. Indexation Sémantique (ChromaDB)
- **Rôle** : Permet à l'IA de retrouver les fragments de code pertinents par rapport à votre intention.
- **Outil** : `citadel_indexer.js`
- **Stockage** : Base vectorielle locale (Port 8008).

### B. Indexation Structurelle (JSON)
- **Rôle** : Permet à l'ImpactAnalyzer de calculer les dépendances et les risques de propagation.
- **Outil** : `citadel_indexer.js` (Mode Hybride v3.1).
- **Stockage** : `server/data/memory/projects/workspace_index.json`.

---

## 🚀 Protocole de Mise en Audit
Avant de lancer `/audit` sur un nouveau répertoire :

1. **Scan Initial** : Vérifiez que le dossier est accessible par le serveur.
2. **Exécution de l'Indexeur** :
   ```bash
   node server/scripts/citadel_indexer.js <PATH_DU_PROJET> <NOM_DU_PROJET>
   ```
3. **Vérification Cockpit** : Assurez-vous que la densité du graphe ne chute pas de manière critique.
4. **Audit d'Impact** : Lancez l'audit. Si le système répond "Needs Indexing", répétez l'étape 2.

## ⚠️ Résolution des Erreurs (Black Screen)
Si l'audit affiche un écran vide, cela signifie généralement que :
- Le projet n'est pas encore présent dans ChromaDB.
- Aucun fichier cible n'a été identifié sémantiquement.
- L'indexeur hybride n'a pas encore mis à jour `workspace_index.json`.

---
#forge #indexation #strategie #audit
