# Skill : Obsidian CLI (Sub-skill ADR-008)

Parent : [[skill-obsidian-governance]]

## Mission
Automatiser les opérations Vault via CLI (list, search, walk récursif).

## Règles
- Prioriser les scans récursifs performants.
- Journaliser les chemins touchés pour audit.
- Fail-closed si le vault path est ambigu.
