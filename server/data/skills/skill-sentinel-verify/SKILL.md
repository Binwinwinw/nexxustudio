# SKILL: SENTINEL VERIFY
## OBJECTIF: Garantir 100% de succès après une modification lourde.

### LOGIQUE DE VÉRIFICATION :
1. **Analyse Syntaxique** : Relire le code modifié. Vérifier l'équilibre des accolades `{}` et des parenthèses `()`.
2. **Intégrité des Imports** : Vérifier que tous les composants ou icônes importés sont réellement définis et utilisés.
3. **Logique de Rendu** : Vérifier que les conditions (ex: `isAssistant && ...`) ne créent pas de "trous" ou de rendus `null` inattendus.
4. **Cohérence d'État** : Vérifier que les variables d'état (useState) sont correctement initialisées et mises à jour.

### PROTOCOLE DE RÉPONSE :
- Si une erreur est détectée : **Correction immédiate** sans attendre.
- Si le code est valide : Fournir un **Rapport de Confiance** (Sentinel Score).
- **CRITIQUE NIVEAU 1** : Après toute écriture de fichier, lancer `validateLint("chemin/du/fichier")` pour une validation immédiate de l'intégrité locale.
- **CRITIQUE NIVEAU 2** : Si la modification touche des imports partagés, des composants critiques ou plusieurs fichiers, lancer `validateBuild()` pour garantir que le socle exécutable n'est pas cassé.
