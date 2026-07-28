# ADR-003 : Knowledge Governance & Evolution Strategy

**Date** : 2026-05-03  
**Statut** : ✅ Validé  
**Expert** : Nexxus (Maître Orchestrateur)

## Contexte
Avec l'activation du Knowledge Hub (ChromaDB) et du pipeline de vision, La Citadelle dispose désormais d'une mémoire sémantique persistante. Cependant, pour éviter le "bruit sémantique" et garantir la précision du rappel (RAG), une politique de gouvernance stricte est nécessaire avant d'étendre la mémoire à des projets tiers massifs.

## Décision
Adoption d'une stratégie de croissance contrôlée par phases :

1. **Standard de Métadonnées V3.1** : Imposition d'un schéma strict (`id`, `type`, `project`, `category`, `source`, `source_display_name`, `title`, `version`, `status`, `ingest_origin`, `chunk_id`, `total_chunks`, `tags`, `timestamp`) pour tous les documents indexés.
2. **Priorisation Native** : Indexation prioritaire du patrimoine interne de La Citadelle (ADR, configurations, schémas techniques) avant toute ingestion externe.
3. **Protocoles d'Ingestion** :
    - **Bootstrap** : Ingestion automatique des fichiers de structure au démarrage.
    - **Vision Pipeline** : Ingestion réactive des découvertes visuelles avec tags automatiques.
    - **Manual Indexing** : Endpoint protégé pour les imports de documentation structurée.
4. **Validation par Benchmark** : Utilisation d'un carnet de tests (`rag_benchmark.js`) pour mesurer la pertinence du rappel sémantique après chaque lot d'ingestion.

## Conséquences
- **Précision** : Limitation des faux positifs en isolant les domaines de connaissance par les métadonnées `project` et `category`.
- **Traçabilité** : Capacité d'identifier l'origine et le statut (active/deprecated) de chaque fragment de mémoire.
- **Évolutivité** : Base solide pour une future montée en charge vers des dépôts multi-projets (ex: MonCoachScolaire).
- **Souveraineté** : Documentation explicite des standards de gestion de données au sein même du système via la [[03-Forge/Strategie-Indexation|Stratégie d'Indexation]].

---
### 🧠 Évolution de la Gouvernance
- [[04-Operations/reports/Rapport-Stabilisation-Knowledge-Hub|🧠 Rapport de Stabilisation du Knowledge Hub]]
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]] (Contrôle v4.5)
- [[03-Forge/Strategie-Indexation|🧬 Stratégie d'Indexation (Forge)]]

---
### 🔗 Liens de Parenté
- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]

