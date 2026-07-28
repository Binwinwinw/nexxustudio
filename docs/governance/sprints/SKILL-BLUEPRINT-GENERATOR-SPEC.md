# 🧠 SPÉCIFICATION TECHNIQUE : SKILL BLUEPRINT GENERATOR (v1.0)

**Type** : Forge Skill / Discovery Transition
**Cible** : MonCoachScolaire CE1 (Pédagogie)
**Statut** : EN ATTENTE D'IMPLÉMENTATION

## 🎯 OBJECTIF

Automatiser la création de Blueprints structurés à partir d'intentions utilisateur floues. Ce skill est le "moteur" qui matérialise la doctrine "Blueprint Before Forge".

## ⛓️ CONTRAT D'ENTRÉE (Input)

- `intent` : String (ex: "Je veux un module de lecture pour CE1").
- `context` : Object (Scans du workspace, fichiers existants).
- `maturity_score` : Number (Doit être > 40% pour déclenchement).

## 📄 CONTRAT DE SORTIE (Output Blueprint)

Le skill doit générer un fichier Markdown conforme au standard Citadelle :

1. **Résumé Stratégique** : Objectif métier.
2. **Impact Architectural** : Fichiers créés/modifiés.
3. **Checklist de Sécurité** : Points de vigilance (LTM).
4. **Validation Plan** : Tests unitaires à lancer après forge.

## 🛡️ GRILLE D'ACCEPTATION CERTIFIÉE (GAC v1.1)

### Axe 1 : Qualification & Préconditions

- **AC-01** : Refus de génération si l'intention est floue (Score Discovery < 40%).
- **AC-02 (PRÉCONDITIONS)** : Le moteur suspend la génération s'il manque l'un des 4 piliers : **Objectif**, **Cible**, **Contrainte majeure**, ou **Artefact de référence**.

### Axe 2 : Structure & Format Canonique

- **AC-03 (FORMAT)** : Sortie mandataire en Markdown structuré avec sections fixes pour garantir la testabilité automatique.
- **MANDATORY BLOCKS** :
  1. **OBJECTIF** : Ce qu’on veut produire.
  2. **CONTEXTE** : Origine (Chat) + Patrimoine (librarianSearch).
  3. **ÉLÉMENTS VÉRIFIÉS** : Confirmés sur disque via scan.
  4. **HYPOTHÈSES PROJETÉES** : Ce qui reste à créer/déduire.
  5. **CONTRAINTES** : Limites techniques, métier ou pédagogiques.
  6. **PLAN FORGE** : Étapes d'exécution sans code final.
  7. **STATUT** : Certifié, Incomplet ou Rejeté.

### Axe 3 : Ancrage & Souveraineté

- **AC-04** : Marquage explicite [VÉRIFIÉ] vs [PROJETÉ] pour chaque composant cité.
- **AC-05** : Interdiction de livrer du code exécutable complet (Signatures & Squelettes uniquement).

### Axe 4 : Gouvernance & Certification

- **AC-06** : Balise `[BLUEPRINT_CERTIFIED]` injectée uniquement si toutes les sections sont validées.
- **AC-07 (REJET)** : En cas d'échec, le système doit produire un statut explicite `[BLUEPRINT_REJECTED]` ou `[BLUEPRINT_INCOMPLETE]` avec la liste des manquants.

### Axe 5 : Testabilité

- **AC-08** : Le Skill doit être benchable (Entrée identique -> Sortie structurée identique).

## 📝 RÉFÉRENCES LTM

- EPISODE-CITADEL-DISCOVERY-DOCTRINE-001
- EPISODE-CITADEL-CERTIFICATION-v3.11.5
