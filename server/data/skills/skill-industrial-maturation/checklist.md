# Checklist de Maturation Industrielle et d'Indexation

- [ ] **Validation du Chemin Cible** : Vérifier que le dossier existe sur le disque et que le chemin fourni est valide et accessible en lecture/écriture.
- [ ] **Filtrage des Fichiers** : Exclure systématiquement les dossiers volumineux ou non pertinents (`node_modules`, `.git`, `dist`, `.venv`, `.next`, `build`, etc.).
- [ ] **Gating de Souveraineté** : S'assurer du consentement explicite de l'utilisateur sur le périmètre de scan.
- [ ] **Planification de l'Indexation** : Estimer la taille du dépôt et découper les lots de fichiers de manière progressive pour éviter toute saturation de la base vectorielle.
- [ ] **Intégrité Vectorielle** : Valider l'insertion dans ChromaDB et s'assurer que les embeddings (nomic-embed-text) sont générés sans erreur critique.
- [ ] **Audit de Précision** : Générer et valider des questions de contrôle après indexation pour évaluer le score de RAG.
