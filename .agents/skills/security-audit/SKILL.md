# SKILL.md — security-audit

## Objectif

Fournir un audit automatisé de la sécurité du code et de la configuration MonCoachScolaire : vérifier la présence des protections essentielles, signaler les manques, proposer des correctifs ou des recommandations concrètes.

## Vérifications principales

- Présence et usage correct de PDO sécurisé (préparé, pas d’input direct dans les requêtes)
- Échappement systématique des sorties utilisateur (htmlspecialchars, trim, etc.)
- Vérification explicite des droits d’accès (isAdmin, $is_admin, $is_logged_in)
- Protection CSRF sur tous les formulaires sensibles
- Session PHP sécurisée (cookie_httponly, cookie_secure, regeneration, etc.)
- Fichiers sensibles non exposés (config.php, .env, backups, etc.)
- Headers HTTP de sécurité (X-Frame-Options, X-Content-Type-Options, etc.)
- Pas de mot de passe ou token en dur dans le code
- Pas de debug/logs exposés en production
- Pas de données sensibles dans les endpoints publics
- Vérification des permissions sur les fichiers/dossiers critiques

## Mode d’emploi

1. Charger ce skill avant toute refonte sécurité ou audit de code.
2. Lister les protections présentes et manquantes (avec fichiers/sections concernés).
3. Proposer un patch minimal ou une checklist d’actions correctives.
4. Documenter toute exception ou cas particulier dans le fichier .memory/security.md.

## Limites

- Ce skill ne remplace pas un audit externe complet, mais garantit un socle de sécurité projet.
- À enrichir à chaque évolution majeure de la stack ou découverte d’un nouveau risque.

---

> Ce skill doit être utilisé à chaque sprint sécurité, avant toute livraison majeure, et lors de l’intégration de nouveaux contributeurs.
