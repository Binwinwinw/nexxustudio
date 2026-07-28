# Skill : Audit SOTA (v1.1)

## 🎯 Mission
Certifier les actifs via les référentiels **OWASP ASVS** (Sécurité Appliquée) et **Privacy by Design** (RGPD).

## 📊 Référentiels d'Évaluation
- **Sécurité (ASVS)** : Auth, gestion de session, contrôle d'accès, secrets, journalisation, exposition des données.
- **Performance** : Temps de chargement (FCP/LCP), taille des bundles, requêtes réseau, blocages UI.
- **RGPD (Sovereign)** : Base légale, minimisation, conservation, protection par défaut, traçabilité.

## 🏗️ Structure du Livrable : Matrice de Remédiation
Le rapport doit impérativement inclure une matrice avec les colonnes :
| Domaine | Exigence | Statut | Preuve | Sévérité | Risque Métier | Correctif | Effort | Priorité |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |

## 🛡️ Règles de Certification (SMAC)
- **0.75** : Aucun point de blocage ASVS Niveau 1.
- **0.85** : Conformité ASVS Niveau 2 + RGPD Minimisation validée.
- **0.95 (SOTA)** : Résilience totale, Zéro Dette critique, Privacy by Default actif.

## 🚫 Interdictions
Ne jamais valider un audit sans preuve technique (extrait de code, log, config).
