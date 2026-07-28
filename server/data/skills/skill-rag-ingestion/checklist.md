# Checklist : Validation RAG Ingestion

- [ ] Les chunks de code respectent-ils les frontières des fonctions/classes (AST) ?
- [ ] Les métadonnées de source (`source_path`) sont-elles présentes ?
- [ ] Le hachage (`chunk_hash`) est-il calculé pour éviter les doublons ?
- [ ] La hiérarchie Markdown (H1/H2) est-elle préservée ?
- [ ] Le score de complétude documentaire est-il > 0.9 ?
