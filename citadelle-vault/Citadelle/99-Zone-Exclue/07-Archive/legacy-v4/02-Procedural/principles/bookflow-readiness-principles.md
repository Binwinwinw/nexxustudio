# Principes durables - bookflow

## Standards extraits
- Un service React/Node ne peut être industrialisé sans documentation opératoire complète.
- Le blindage des headers (Helmet) et la sanitisation des erreurs sont des prérequis non négociables.
- La maturité documentaire (Scorecard) doit atteindre 40/50 pour autoriser la Forge.

## Jurisprudence
# 🏛️ ADR-001 : Stratégie de Sécurité Bookflow

**Date :** 09 Mai 2026  
**Statut :** Accepté  
**Auteur :** Nexxus Architect

## Contexte
Le projet Bookflow, en tant que fleuron de la Forge, nécessite un niveau de protection supérieur pour garantir l'intégrité des données des livres et des transactions Stripe. L'audit initial a révélé des manques sur les headers HTTP et une vulnérabilité critique dans `axios`.

## Décisions

### 1. Renforcement des Headers HTTP
Nous avons implémenté **Helmet** sur le backend Express. 
- **Conséquence :** Protection contre le Content Sniffing, le Clickjacking et retrait du header `X-Powered-By`.

### 2. Isolation des Secrets
Toutes les clés sensibles (Stripe, DB) sont strictement isolées dans des variables d'environnement.
- **Conséquence :** Aucun secret n'est présent dans le dépôt Git.

### 3. Gestion des Vulnérabilités (Patching)
Mise à jour immédiate vers `axios@latest` pour corriger les failles de *Prototype Pollution*.
- **Conséquence :** Suppression du risque d'injection de credentials via des gadgets JS.

### 4. Sanitisation des Erreurs
Les messages d'erreur détaillés (stack traces) ne sont plus renvoyés au client.
- **Conséquence :** Réduction de la surface d'attaque par reconnaissance d'erreurs.

## Alternatives considérées
- **CORS strict :** Nous avons choisi une whitelist dynamique plutôt qu'un wildcard `*` pour restreindre les appels API au seul frontend légitime.

## Implications
- Les développeurs doivent désormais configurer correctement le fichier `.env` pour que l'application fonctionne.
- L'ajout de nouvelles routes nécessite de vérifier si elles doivent être protégées par une couche d'authentification (prochaine phase).
