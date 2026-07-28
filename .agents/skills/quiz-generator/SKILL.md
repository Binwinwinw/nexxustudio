---
name: quiz-generator
description: Crée ou corrige un script Python generate_<matiere>_<niveau>.py pour MonCoachScolaire. Utiliser pour générer de nouveaux quiz diagnostiques, corriger un schéma JSON non conforme, ou normaliser un script legacy. Produit quiz/<id>.json (sans réponses) et quiz_answers/<id>.json (avec corrections). Checklist 7 points obligatoires intégrée.
argument-hint: [matiere] [niveau] [IDs min-max]
---

# Skill — Quiz Generator Python

## Objectif

Créer ou corriger un script `generate_<matiere>_<niveau>.py` conforme au pattern standard MonCoachScolaire.

> Important : pour les nouveaux scripts, ne générer que des questions de type `qcm` et `vrai-faux`.

## Localisation

```
dev/tools/quiz/
├── generate_svt_3eme.py     ← Référence IDs 651–698
├── generate_pc_3eme.py      ← Référence IDs 699–746
├── generate_svt_1ere.py     ← IDs 603–650
├── generate_hg_3eme.py      ← IDs 555–602
├── generate_francais_1ere.py ← IDs 466–500
├── generate_hg_1ere.py      ← IDs 175–223
├── generate_pc_1ere.py      ← IDs 273–321
└── generate_philo_1ere.py   ← IDs 224–272
```

**Sortie de chaque script :**

```
dev/tools/quiz/<matiere>_<niveau>_quizzes/
├── quiz/<id>.json          ← Questions SANS réponses (côté élève)
└── quiz_answers/<id>.json  ← Réponses + explications (côté API)
```

## Workflow détaillé

Ce skill doit guider la création d’un script `generate_<matiere>_<niveau>.py` clair, réutilisable et conforme au standard MonCoachScolaire.

### Objectif du workflow

- Produire un script autonome qui génère deux dossiers JSON : `quiz/` et `quiz_answers/`.
- Respecter le pattern `qcm` / `vrai-faux` uniquement.
- Fournir une validation explicite des types de questions.
- Garantir que les fichiers publics n’incluent pas de réponses.

### Étape 1 — Choisir la plage d’IDs

- Vérifier l’ID max existant dans `dev/tools/quiz/` avant d’ajouter un nouveau script.
- Documenter la plage dans l’en-tête du fichier et dans le commentaire du bloc.
- Exemple : IDs `747–794` pour un script suivant `generate_pc_3eme.py`.

### Étape 2 — Écrire l’en-tête et les imports

- Ajouter le header de fichier avec UTF-8 et la description.
- Importer uniquement : `json`, `os`, `from datetime import UTC, datetime`.
- Ne pas utiliser `datetime.utcnow()` ni `import datetime` seul.

### Étape 3 — Définir les chemins de sortie

- Utiliser `SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))`.
- Créer les constantes :
  - `<MATIERE>_OUTPUT_DIR`
  - `<MATIERE>_QUIZ_DIR`
  - `<MATIERE>_ANSWERS_DIR`
- Créer les dossiers avec `os.makedirs(..., exist_ok=True)`.

### Étape 4 — Implémenter `make_quiz()`

- Générer l’objet élève sans champs de correction.
- Supprimer `correct_answer`, `correct_option`, `correct`, `explanation`.
- Ajouter `created_at` en ISO 8601 UTC.

### Étape 5 — Implémenter `make_answers()`

- Gérer uniquement :
  - `qcm` → `correct_option`
  - `vrai-faux` → `correct`
- Rejeter tout autre type avec un `ValueError` clair.
- Le code doit être lisible et facile à maintenir.

### Étape 6 — Remplir `quizzes_data`

- Utiliser une liste de tuples `(id, title, subject, level, questions)`.
- Chaque question doit avoir un identifiant unique au format `"<quiz_id>_<numero>"`.
- Respecter le pattern de questions recommandé :
  `qcm, vrai-faux, qcm, vrai-faux, qcm, vrai-faux, qcm, vrai-faux`.

### Étape 7 — Écrire `write_quiz_files()`

- Créer la boucle d’export avec `make_quiz()` et `make_answers()`.
- Écrire chaque fichier JSON en UTF-8 avec `ensure_ascii=False` et `indent=2`.
- Afficher un message de synthèse à la fin.

### Étape 8 — Tester le script

- Exécuter le script localement.
- Vérifier que le nombre de fichiers produit correspond à `len(quizzes_data)`.
- Contrôler les structures JSON générées.

## Checklist 7 points obligatoires

Avant toute génération ou correction, vérifier chaque point :

### 1. Import datetime moderne

```python
from datetime import UTC, datetime
```

**Interdit :** `datetime.utcnow()`, `import datetime` seul.

### 2. Constantes de chemin SCRIPT_DIR-relatifs

```python
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
<MATIERE>_OUTPUT_DIR  = os.path.join(SCRIPT_DIR, "<matiere>_<niveau>_quizzes")
<MATIERE>_QUIZ_DIR    = os.path.join(<MATIERE>_OUTPUT_DIR, "quiz")
<MATIERE>_ANSWERS_DIR = os.path.join(<MATIERE>_OUTPUT_DIR, "quiz_answers")
```

**Interdit :** chemins en dur `"quizzes"` ou `"answers"`.

### 3. make_quiz — striper les champs de correction

```python
def make_quiz(qid, title, subject, level, questions):
    answer_keys = {"correct_answer", "correct_option", "correct", "explanation"}
    return {
        "id": qid,
        "title": title,
        "subject": subject,
        "level": level,
        "created_at": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "questions": [
            {k: v for k, v in q.items() if k not in answer_keys}
            for q in questions
        ]
    }
```

### 4. make_answers — dispatch complet par type

```python
def make_answers(qid, title, subject, level, questions):
    answers = []
    for q in questions:
        if q["type"] == "qcm":
            answers.append({
                "question_id": q["id"],
                "correct_option": q["correct_option"],
                "explanation": q["explanation"]
            })
        elif q["type"] == "vrai-faux":
            answers.append({
                "question_id": q["id"],
                "correct": q["correct"],        # bool
                "explanation": q["explanation"]
            })
        else:
            raise ValueError(f"Type de question invalide : {q['type']}. Utiliser uniquement 'qcm' ou 'vrai-faux'.")
    return {"quiz_id": qid, "title": title, "subject": subject,
            "level": level, "answers": answers}
```

**Important :** pour les nouveaux scripts, n’utiliser que `qcm` et `vrai-faux`.

## Schéma JSON cible

**quiz/<id>.json :**

```json
{
  "id": 1,
  "title": "Quiz titre",
  "subject": "Matière",
  "level": "niveau",
  "created_at": "2026-03-12T10:00:00Z",
  "questions": [
    {
      "id": 1,
      "type": "qcm",
      "question": "Question à choix multiples ?",
      "options": ["A", "B", "C", "D"]
    },
    { "id": 2, "type": "vrai-faux", "question": "Affirmation ?" }
  ]
}
```

**quiz_answers/<id>.json :**

```json
{
  "quiz_id": 1,
  "title": "Quiz titre",
  "subject": "Matière",
  "level": "niveau",
  "answers": [
    { "question_id": 1, "correct_option": "B", "explanation": "Car..." },
    { "question_id": 2, "correct": true, "explanation": "Car..." }
  ]
}
```

## Exécution

```powershell
# Activer le venv
& .venv\Scripts\Activate.ps1

# Générer les fichiers
python dev/tools/quiz/generate_<matiere>_<niveau>.py

# Vérifier la sortie
Get-ChildItem dev/tools/quiz/<matiere>_<niveau>_quizzes/quiz/ | Measure-Object
```

## Pattern de questions (8 questions/quiz recommandé)

```
qcm, vrai-faux, qcm, vrai-faux, qcm, vrai-faux, qcm, vrai-faux
```

```

```
