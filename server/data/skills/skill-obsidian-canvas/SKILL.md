# Skill : Obsidian Canvas (Sub-skill ADR-008)

Parent : [[skill-obsidian-governance]]

## Mission
Manipuler les fichiers `.canvas` sans corrompre la structure JSON native.

## Règles
- Préserver les IDs uniques des nœuds.
- Ne pas supprimer les métadonnées de position sans demande explicite.
- Valider le JSON avant écriture.
