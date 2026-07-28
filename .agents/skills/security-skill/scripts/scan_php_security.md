# Documentation — scan_php_security.py

Ce script Python effectue une analyse statique de sécurité sur le code PHP et JS du projet MonCoachScolaire.

## Fonctionnalités principales

- Scanne tous les fichiers PHP du dossier `src/` pour détecter :
  - Patterns dangereux (eval, exec, system, shell_exec, base64_decode, unserialize, etc.)
  - Accès fichiers risqués (fopen, file_put_contents, unlink, etc.)
  - Echo/print de variables non échappées (risque XSS)
- Scanne tous les fichiers JS du dossier `public/assets/js/` pour détecter :
  - Patterns dangereux (eval, Function, innerHTML)

## Utilisation

```bash
cd dev/tools/security-skill/scripts
python scan_php_security.py
```

Le rapport s’affiche en console. Si aucune vulnérabilité critique n’est détectée, le script l’indique explicitement.

## Intégration

- Ce script complète les outils existants du skill `security-skill`.
- Peut être intégré dans le rapport global via `generate_security_report.php` (ajout recommandé).

## Historique

- 18/03/2026 : Création du script mixte PHP/JS.
- 18/03/2026 : Ajout de la détection JS (eval, Function, innerHTML).

---

Pour toute question, voir [README.md](../README.md) ou contacter l’équipe MonCoachScolaire.
