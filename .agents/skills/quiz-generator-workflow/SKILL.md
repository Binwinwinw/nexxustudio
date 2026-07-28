---
name: quiz-generator-workflow
description: Guide la création et l’amélioration d’un workflow Python de génération de quiz pour MonCoachScolaire. Utiliser pour définir la structure, les étapes et la validation d’un script generate_<matiere>_<niveau>.py.
argument-hint: [matiere] [niveau] [IDs min-max]
---

# Skill — Quiz Generator Workflow

## Objectif

Définir et documenter le workflow complet pour générer ou enrichir un script Python `generate_<matiere>_<niveau>.py` dans MonCoachScolaire.

Ce skill priorise :

- la structure standard du script,
- la construction des dossiers `quiz/` et `quiz_answers/`,
- la validation du format JSON,
- le respect des types de question `qcm` et `vrai-faux`.

## Localisation

Le workflow s’applique aux scripts de génération situés dans :

```
dev/tools/quiz/
```

et aux sorties suivantes :

```
dev/tools/quiz/<matiere>_<niveau>_quizzes/
├── quiz/<id>.json
└── quiz_answers/<id>.json
```

## Workflow détaillé

### Étape 1 — Choisir la plage d’IDs

- Vérifier l’ID max existant dans `dev/tools/quiz/` avant d’ajouter un nouveau script.
- Documenter la plage d’IDs dans l’en-tête du fichier.
- Préférer des plages cohérentes avec les scripts existants et éviter les chevauchements.

### Étape 2 — Structure du script

- Ajouter un header clair avec l’encodage UTF-8 et la description du quiz.
- Importer uniquement :
  - `json`
  - `os`
  - `from datetime import UTC, datetime`
- Ne pas utiliser `datetime.utcnow()` ou `import datetime` isolé.

### Étape 3 — Définir les chemins de sortie

- Utiliser `SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))`.
- Créer des constantes de chemin relatives :
  - `<MATIERE>_OUTPUT_DIR`
  - `<MATIERE>_QUIZ_DIR`
  - `<MATIERE>_ANSWERS_DIR`
- Créer les dossiers avec `os.makedirs(..., exist_ok=True)`.

### Étape 4 — Générer les quiz

- Implémenter `make_quiz()` pour produire l’objet destiné à l’élève.
- Supprimer tous les champs de correction :
  - `correct_answer`
  - `correct_option`
  - `correct`
  - `explanation`
- Ajouter `created_at` au format ISO 8601 UTC.

### Étape 5 — Générer les réponses

- Implémenter `make_answers()` pour produire les fichiers de correction.
- Gérer uniquement les types :
  - `qcm` → `correct_option`
  - `vrai-faux` → `correct`
- Rejeter tout autre type avec une erreur explicite.

### Étape 6 — Construire les données du quiz

- Utiliser une structure de données claire, par exemple une liste de tuples.
- Chaque quiz doit contenir :
  - `id`
  - `title`
  - `subject`
  - `level`
  - `questions`
- Chaque question doit avoir un identifiant unique et respecter un schéma stable.

### Étape 7 — Exporter les fichiers JSON

- Écrire les fichiers en UTF-8 avec :
  - `ensure_ascii=False`
  - `indent=2`
- Vérifier que chaque quiz produit bien deux fichiers :
  - `quiz/<id>.json`
  - `quiz_answers/<id>.json`

### Étape 8 — Tester le workflow

- Exécuter le script localement.
- Vérifier le nombre de fichiers produits.
- Contrôler la structure JSON des deux sorties.
- S’assurer que la sortie élève ne contient aucune réponse.

## Checklist 7 points obligatoires

1. Import datetime moderne :
   - `from datetime import UTC, datetime`
   - Interdit : `datetime.utcnow()`, `import datetime`

2. Chemins relatifs via `SCRIPT_DIR`.

3. `make_quiz()` supprime tous les champs de correction.

4. `make_answers()` gère uniquement `qcm` et `vrai-faux`.

5. Sorties JSON claires et indentées.

6. Documenter la plage d’IDs dans l’en-tête.

7. Tester la génération et valider les fichiers créés.
