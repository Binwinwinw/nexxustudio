#!/bin/bash
# install.sh — Installer cross-plateforme pour exercises-skill

SKILL_NAME="exercises-skill"

# Détection du dossier cible
if [ -d "$HOME/.agents/skills/" ]; then
  TARGET="$HOME/.agents/skills/$SKILL_NAME"
elif [ -d "$HOME/.claude/skills/" ]; then
  TARGET="$HOME/.claude/skills/$SKILL_NAME"
elif [ -d ".cursor/rules/" ]; then
  TARGET=".cursor/rules/$SKILL_NAME"
else
  TARGET="$HOME/.agents/skills/$SKILL_NAME"
fi

mkdir -p "$TARGET"
cp -R ./* "$TARGET"/
chmod +x "$TARGET/install.sh"
echo "Skill $SKILL_NAME installé dans $TARGET"
