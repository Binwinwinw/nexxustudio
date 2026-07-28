# Rubrique d'Annotation du Golden Dataset (Nexxus)

Cette rubrique a été créée pour standardiser l'annotation manuelle des requêtes extraites de la production (Golden Dataset). Elle définit comment qualifier la "vérité terrain" afin de calibrer le *Context Tracker* et l'orchestrateur.

## 1. Objectif de l'Annotation
L'annotation consiste à ajouter ou corriger manuellement les champs suivants pour chaque log brut :
- **`ground_truth_intent`** : L'intention exacte que l'orchestrateur aurait dû comprendre.
- **`is_multi_turn`** : `true` si la requête dépend sémantiquement des tours précédents.
- **`is_ambiguous`** : `true` si la requête est intrinsèquement vague, même pour un humain.
- **`context_failure`** : `true` si le système a perdu le fil ou redéfini inutilement le sujet.

## 2. Règles de Labellisation

### `ground_truth_intent` (Intention Réelle)
- **social / greeting** : Mots simples comme "bonjour", "salut", "comment vas-tu".
- **general_question** : Demande d'explication ou de culture générale ("qu'est-ce qu'un smartphone pliable").
- **clarification** : La requête est impossible à traiter sans plus d'infos.

### `is_multi_turn` (Dépendance Contextuelle)
- **OUI (`true`)** si la phrase contient une anaphore ("ça", "il", "son poids") **OU** si elle manque de verbe/sujet explicite (ex: "et l'autonomie ?").
- **NON (`false`)** si la phrase est auto-suffisante ("comment t'appelles-tu ?").

### `is_ambiguous` (Ambiguïté Humaine)
- **OUI (`true`)** si un humain ne saurait pas répondre sans demander des précisions.
- **NON (`false`)** si l'orthographe est mauvaise ou la formulation elliptique, mais que l'intention est claire (ex: "est ce q tu sais ce q les smartphones pliables").

### `context_failure` (Échec de l'Assistant)
- **OUI (`true`)** si, dans les logs historiques, l'assistant a répondu "Le système a rencontré une erreur", a fait du hors-sujet total, ou a refait une introduction complète sur un sous-thème.
- **NON (`false`)** si l'assistant a bien rebondi.

## 3. Workflow d'Annotation
1. Ouvrir le fichier `golden_dataset_preview.csv`.
2. Appliquer mentalement ces règles sur chaque ligne.
3. Remplir les colonnes additionnelles.
4. Injecter les résultats back dans `golden_dataset.json` pour exécution dans la CI.
