# Revue d'Architecture n°1 : MonCoachScolaire

**Date** : 2026-05-06
**Skill** : Architecture Review v1.0
**Baseline** : Audit UI v1 (0.84)

## 📋 Inventaire de la Dette (Priorisée)

### 1. Sécurité : Content Security Policy (Score: 125)
- **Type** : Dette Bloquante.
- **Impact** : Risque d'injection XSS total.
- **Remédiation** : Implémenter une méta-balise CSP stricte.

### 2. Sécurité : Subresource Integrity (Score: 100)
- **Type** : Dette Bloquante.
- **Impact** : Risque de Supply Chain attack via CDN.
- **Remédiation** : Ajouter les attributs `integrity` sur Tailwind et Framer.

### 3. Performance : Build Tailwind CDN (Score: 24)
- **Type** : Dette Évolutive.
- **Impact** : Temps de chargement excessif sur mobile.
- **Remédiation** : Migration vers PostCSS/Tailwind CLI.

## 📜 Propositions d'ADR
1.  **ADR-009** : Standard de Sécurité Applicative (CSP & SRI).
2.  **ADR-010** : Stratégie de Build & Performance (PostCSS).

#moncoach #architecture #dette #roadmap
