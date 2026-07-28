# Skill : Architecture Review (v1.0)

## 🎯 Mission
Transformer la dette technique en décisions d'architecture (ADR) et prioriser la roadmap de refactoring.

## 📊 Barème de Priorisation
Calculer le score pour chaque élément de dette :
**Priorité = Risque × Impact × Portée**
- **Risque** : Probabilité de panne ou faille (1-5).
- **Impact** : Gravité sur l'utilisateur final (1-5).
- **Portée** : Nombre de modules affectés (1-5).

## 🗂️ Classification de la Dette
1. **Dette Bloquante** : Correction impérative avant toute nouvelle feature.
2. **Dette Tolérable** : Acceptable temporairement sous surveillance (logs).
3. **Dette Évolutive** : Refactoring à coupler avec la prochaine évolution produit.

## 🏗️ Structure du Rapport
- **Inventaire par Module** : Liste exhaustive des écarts par dossier (`01-Architecture`, `02-Schemas`, `03-UI`).
- **Matrice Priorité** : Application du barème.
- **Propositions d'ADR** : Ébauches de décisions pour résoudre les points bloquants.
- **Ordre de Traitement** : Roadmap recommandée.

## 🛡️ Règle d'Or
Toujours lier une dette technique à un impact métier ou utilisateur concret.
#architecture #dette #sota
