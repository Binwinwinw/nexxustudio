# SKILL : SENTINEL TRACE (Retraçage de Pipeline)

## Vision
Ne jamais corriger une erreur sans avoir recalculé la validité de la chaîne logique qui l'a produite. Le système doit remonter le pipeline de données pour identifier le point de rupture initial.

## Protocole de Diagnostic (Pipeline Scan)
Lorsqu'une erreur (syntaxique, logique ou runtime) est détectée :

1. **Phase de Remontée (Trace Back)** :
    - Identifier le fichier où l'erreur est apparue.
    - Chercher les dépendances directes (imports, props, variables globales).
    - Vérifier si la donnée entrante est conforme aux attentes du composant.

2. **Audit de Logique (Systemic Review)** :
    - L'erreur est-elle un symptôme d'un changement structurel récent ?
    - La correction envisagée va-t-elle fragiliser un autre maillon de la chaîne ?
    - *Règle d'Or* : Si une variable manque, chercher pourquoi elle a disparu du flux global, pas juste la recréer localement.

3. **Recalcul de Solution (Pivot)** :
    - Proposer une solution qui durcit le pipeline (ex: Safe Check, Error Boundary, Default Strategy).
    - Mettre à jour les documents de convention (`docs/conventions.md`) si une nouvelle norme de sécurité émerge de cette erreur.

## Application dans Nexxus Studio
Ce protocole doit être invoqué systématiquement par l'Assistant lors d'une phase de debug complexe.
- **Trigger** : "Échec de compilation", "Écran noir", "Comportement incohérent".
- **Sortie attendue** : Un rapport de trace montrant le chemin de l'erreur du point A (origine) au point B (crash).
