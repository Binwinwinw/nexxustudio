# Références — security-audit-skill

## Documentation principale

- [dev/tools/README.md](../README.md)
- [DOCUMENTATION.md](../../../DOCUMENTATION.md)
- [CONTEXT_INDEX.md](../../../CONTEXT_INDEX.md)

## Scripts inclus

- scan_php_vuln.php : Détecte patterns dangereux dans le code PHP
- scan_env_exposure.sh : Vérifie la présence de fichiers sensibles exposés
- scan_admin_rights.php : Contrôle la gestion des droits admin
- scan_api_security.js : Teste les endpoints API pour accès non autorisé
- scan_dependencies.sh : Check vulnérabilités connues (composer/npm audit)
- generate_security_report.php : Assemble le rapport global

## Workflows supportés

- Audit complet
- Scan code/config
- Scan endpoints
- Rapport sécurité

## Pour aller plus loin

- Voir [dev/tools/README.md](../README.md) pour l'inventaire complet et les commandes détaillées.
