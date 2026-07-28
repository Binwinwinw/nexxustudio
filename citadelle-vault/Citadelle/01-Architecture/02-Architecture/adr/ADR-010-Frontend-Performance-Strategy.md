# ADR-010 : Frontend Performance Strategy

**Statut** : Actif
**Version** : 1.0

## Contexte

L'utilisation massive de CDN pour Tailwind et Framer Motion (bien que pratique pour la Forge) dégrade la performance p95 et la souveraineté des ressources.

## Décision

Migration progressive vers un pipeline de build local :

1. **Compilation Tailwind** : Utilisation de Tailwind CLI/PostCSS pour ne livrer que le CSS utilisé.
2. **Hébergement Local** : Les bibliothèques critiques seront progressivement migrées du CDN vers le stockage local du serveur.

## Conséquences

- Réduction drastique du poids des pages (-80% attendus sur le CSS).
- Amélioration de la souveraineté (pas de dépendance à la disponibilité des CDN tiers).
- Processus de déploiement légèrement plus complexe (build requis).

---

### 🔗 Liens de Parenté

- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]
