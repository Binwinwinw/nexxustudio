# ADR-006 : Sovereign Memory Bridge (Obsidian)

**Statut** : Actif
**Version** : 1.0

## Contexte
La Citadelle a besoin d'une mémoire persistante, structurée et consultable pour maintenir sa souveraineté décisionnelle à travers les sessions.

## Décision
Intégration d'un pont direct (`obsidianBridge.js`) entre l'agent Nexxus et le Vault Obsidian. 
Obsidian n'est plus un simple outil de prise de notes, mais devient le **Système de Fichiers de Connaissance** natif de l'IA.

## Capacités du Pont
1. **Lecture/Écriture** : Nexxus peut mettre à jour ses propres manifestes.
2. **Recherche Sémantique** : Le Vault sert de source pour le RAG local.
3. **Persistance d'État** : Les scores SMAC et les maturités de projets sont stockés dans Obsidian.

## Conséquences
- **Transparence** : L'utilisateur voit l'IA "penser" et "écrire" dans le Vault.
- **Dédoublonnage** : Le pont utilise ADR-004 pour éviter les répétitions lors de l'écriture de notes longues.
