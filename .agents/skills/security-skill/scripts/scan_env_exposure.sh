#!/bin/bash
# scan_env_exposure.sh — Vérifie la présence de fichiers sensibles exposés
find . -type f \( -name ".env" -o -name "*.sql" -o -name "*backup*" -o -name "*log*" \) -exec ls -l {} \;
