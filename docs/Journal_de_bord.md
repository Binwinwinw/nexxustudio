# Journal de Bord - Nexxus Citadel

## [2026-06-26] v4.7.0 - "Fiabilisation du Routage et Calibration"
- **Action** : Refactorisation du Vault, ajustement du routage conversationnel, et durcissement de GroundTruthService.
- **Détails** :
    - **Vault Canonical** : Passage à une arborescence en 5 piliers actifs + zone exclue. Ajout des exclusions à l'indexeur (brouillons/archives).
    - **Micro-signaux sociaux** : Interceptions instantanées des salutations courtes et "acknowledgments" (top, carré), gestion des messages mixtes.
    - **Clarification** : Écho explicite du noyau ambigu, suivi d'une clarification courte, complice et orientée action.
    - **Fallbacks** : Réécriture dans un style plus direct et humain ("concierge / collègue de la Citadelle"). Refus léger, action impossible.
    - **Architecture** : Confirmation du rôle central de 5 fichiers (intent classifier, recall synthesizer, grounding validator, tool registry, ground truth service).
    - **GroundTruthService** : Implémentation de l'injection des chemins, index auto-réparant, metadata enrichies, calcul de variance/stdDev de dérive (avec sample size) et récupération des dernières annotations. Validation par smoke test avec corruption volontaire.
- **Statut** : Amélioration majeure de la fluidité conversationnelle, fiabilité du routage/rappel, et mesurabilité de la qualité du système. Tests unitaires et smoke tests validés.

## [2026-05-17] v4.6.1 - "Blindage Concurrent du Versionnement"
- **Action** : Correction d'un bug de collision de version (`ER_DUP_ENTRY`) sur `session_events`.
- **Détails** :
    - **Cause** : `validateProject` recevait une version calculée côté applicatif (`result.version + 1`), potentiellement stale sous concurrence.
    - **Fix** : `validateProject` verrouille désormais la ligne `project_sessions` via `SELECT ... FOR UPDATE` (pattern identique à `recordEvent`), lit `last_event_version`, incrémente et maintient le compteur à jour — **DB-authoritative**.
    - **Résilience** : La validation devient non-bloquante (`try/catch`) ; un échec dérivé ne plante plus le flux utilisateur.
    - **Log structuré** : Code métier `VALIDATION_EVENT_WRITE_FAILED` avec session et version tentée pour faciliter le diagnostic.
    - **Test** : Ajout de `server/tests/manual/test-concurrency.mjs` pour vérifier l'absence de collision sous N requêtes parallèles.
- **Statut** : Le versionnement événementiel est correctement sérialisé sur MySQL/InnoDB.

## [2026-05-17] v4.6.0 - "Pipeline Épistémique & Fail-Closed"
- **Action** : Finalisation de la boucle de vérité (Phase 1) pour l'anti-hallucination.
- **Détails** : 
    - **Extraction & Synthèse Bridée** : Spécialisation du `FactExtractorAgent` (sur `qwen3.5:4b`) et du `SynthesisAgent` (restreint aux claims extraits).
    - **Critic Veto (Fail-Closed)** : Validation stricte claim-par-claim par le `CriticAgent` avec support du verdict `rejected_precheck`.
    - **Résilience JSON** : Nettoyage multi-passes (retrait des `<think>` et *trailing commas*) garantissant l'intégrité structurelle des contrats Ajv.
    - **Mini-API Asynchrone** : Mise en place de `POST /api/pipeline/submit` et `GET /api/pipeline/:job_id` (polling) pour absorber la latence des modèles lourds en tâche de fond.
- **Statut** : Le pipeline épistémique est bouclé, audité et "fail-closed". La Citadelle refuse d'halluciner.

## [2026-05-16] v4.5.0 - "L'Industrialisation des Protocoles"
- **Action** : Déploiement des outils de maintenance et durcissement épistémique.
- **Détails** : 
    - **Suite de Scripts** : Centralisation des outils de diagnostic dans `server/src/scripts`.
    - **Preuve par Observation** : Basculement du pipeline vers un mode "Preuve avant Affirmation" (ADR-004).
    - **Radar V2** : Détection des attaques Unicode par surrogate pairs.
- **Statut** : La Citadelle est désormais un système **vérifiable et auditable**. Les hallucinations techniques sont activement combattues par le CriticAgent.



## [2026-05-09] v3.4.0 - "Neural Matrix & Ready-Fast"
- **Action** : Industrialisation de la performance et spécialisation d'élite.
- **Détails** : 
    - **Architecture Ready-Fast** : Démarrage instantané du backend et warmup asynchrone par tiers (Chat ➡️ Stratégie ➡️ Forge).
    - **Neural Matrix 4-Tiers** : Déploiement du triptyque d'élite (`vox` / `4b` / `r1:8b` / `27b`).
    - **Benchmark SOTA** : Validation du **Tier 1 (4b)** à **50.3 tok/s** (3.5x plus rapide que le 9b).
    - **VRAM Unload** : Implémentation d'une politique de libération GPU automatique pour les modèles lourds (>10GB) après 10 min d'inactivité.
    - **Rigueur Critique** : Escalade systématique vers le Tier 3 (27b) pour les audits de sécurité et d'architecture.
- **Statut** : La Citadelle est désormais l'infrastructure souveraine la plus rapide et la plus analytique déployée à ce jour.

## [2026-05-03] v3.3.0 - "Vecteur & Vision"
- **Action** : Déploiement de la Vision Multimodale Souveraine.
- **Détails** : 
    - **Vision Qwen3-VL** : Intégration de `imageAnalyzer.js` utilisant `qwen3-vl:8b` (disponible localement) et `Tesseract.js` pour l'OCR.
    - **Interface Vision** : Ajout du support upload (Multer) et bouton "Trombone" dans `ChatBento.jsx` avec feedback d'analyse en temps réel.
    - **ADR-002** : Documentation de la décision d'architecture pour la vision multimodale souveraine.
- **Statut** : La Citadelle possède désormais une vision complète (Web + Image) et un patrimoine conscient.

## [2026-05-03] v3.2.0 - "Souveraineté & Performance"
- **Action** : Finalisation de l'infrastructure de haute performance et vision externe.
- **Détails** : 
    - **Vision Web Native** : Implémentation de `webSummarizer.js` (compliance robots.txt) et correction du biais cognitif via **ADR-001 (Sovereign Override)**.
    - **Patrimoine (HeritageLibrarian)** : Système hybride Blueprint + Scanner Legacy permettant l'indexation sémantique de tout le dossier `/projects`.
    - **Performance V3.1 High-Speed** : VRAM permanente (`keep_alive: -1`) et `warmupService` pour des réponses instantanées (<2s).
    - **Sécurité V3.2** : Déploiement de l'**Armure Cognitive** dans `retrievalGuard.js` (Security by Default + Télémétrie de souveraineté).
- **Statut** : La Citadelle est désormais un système industriel mature, conscient de son passé et capable de lire le futur sur le web.

## [2026-05-02] v3.1.0 - "L'Éveil de la Citadelle"
- **Action** : Mutation structurelle et identitaire vers La Citadelle v3.0.
- **Détails** : 
    - **Refonte Ergonomique** : Inversion du layout pour prioriser le dialogue Mentor.
    - **Souveraineté Augmentée** : Intégration de l'Audit d'Impact (Modes Fichier/Module) et routage cognitif temps réel (Pensée -> Console).
    - **Forge Passive-Active** : Suppression du briefing manuel au profit d'un déclenchement par Readiness Score.
    - **Stabilité** : Nettoyage ESM et correction des instabilités de rendu React.
- **Statut** : La Citadelle est désormais une infrastructure opérationnelle, souveraine et ergonomique.

## [2026-05-01] v2.9.1 - "Réflexion Souveraine"
- **Action** : Optimisation de la gestion de la pensée complexe suite à la v2.9.0.
- **Détails** : 
    - Le système mobilise désormais le raisonnement profond (8B) sans sacrifier la fluidité globale.
    - Séparation étanche renforcée entre le "cerveau" (Console) et la "voix" (Chat).
    - Correction du bypass social pour les questions mixtes.
- **Statut** : Équilibre parfait entre puissance, autorité et élégance.

## [2026-05-01] v2.9.0 - Séparation Structurelle Chat/Forge
- **Action** : Verrouillage des modèles par zone de criticité (Speed vs Power).
- **Détails** : 
    - `CHAT` fixé sur 4B pour la réactivité Mentor.
    - `CHAT_REASONER` (8B) pour la phase Discovery/Validation.
    - `FORGE_REASONER` (14B+) sanctuaire exclusif de la production.
- **Statut** : Équilibre parfait trouvé entre confort utilisateur (chat instantané) et rigueur de production.

## [2026-04-27] v2.2.3 - Chargement par couches & télémétrie de tour
- **Action** : formalisation de l'architecture de chargement progressif et instrumentation légère par requête.
- **Détails** :
    - couches de routage explicitées (`L0_BOOTSTRAP`, `L1_LEXICAL_ROUTING`, `L2_COGNITIVE_SELECTION`, `L3_EXPERT_HYDRATION`, `L3_DOCUMENT`) ;
    - budgets bornés ajoutés pour limiter les candidats, les hydratations et le bootstrap ;
    - télémétrie de tour ajoutée pour résumer les couches activées, les coûts et les chargements réels ;
    - objectif affirmé : ne charger que ce qui sert réellement la décision ou la réponse.
- **Statut** : architecture plus lisible, plus mesurable et plus sobre sur les tâches simples, sans renoncer à la profondeur sur les tâches complexes.

## [2026-04-25] v2.2.2 - Chat Mentor stabilisé
- **Action** : consolidation du chat assistant après série de réponses vides ou répétitives.
- **Détails** :
    - récupération visible ajoutée quand le flux principal produit surtout du raisonnement interne ;
    - historique du chat nettoyé côté frontend pour ne plus renvoyer de messages assistant vides ;
    - VOX retiré du parcours mentor/discovery pour éviter les boucles inutiles ;
    - fallback spécialisé ajouté pour les demandes d'atelier et de plan détaillé ;
    - routage plus direct pour les demandes d'accompagnement structurées.
- **Statut** : nette amélioration de la continuité conversationnelle, sans retour au silence ni aux répétitions les plus grossières.

## [2026-04-12] v2.2.1 - Architecture "Triumvirat" & Hybrid Hardened (V7.4)
- **Action** : Stabilisation critique et montée en gamme de l'intelligence collective.
- **Réalisations** : 
    - **Le Triumvirat** : Spécialisation des modèles (DeepSeek-R1 / Qwen2.5 / Mistral) optimisée pour **8 Go de VRAM**.
    - **Inference Hardening** : Bridage du contexte à **4096 tokens** et gestion déterministe de la mémoire GPU.
    - **Routage Hybride (SOTA V7.4)** : Implémentation du moteur BM25 couplé à la similarité sémantique via **Reciprocal Rank Fusion (RRF)**.
    - **Optimisation** : Pondération des champs (Boost nom x3) et Tokenisation "Tech-aware".
    - **Visibilité** : Monitoring VRAM interactif intégré à la console d'orchestration.
- **Statut** : Station en mode "Béton Armé". Prête pour la production autonome du Projet Sentinel.

## [2026-04-11] v2.2 - Intelligence de Pointe (SOTA V4)
- **Action** : Optimisation hardware et mode Brainstorming.
- **Détails** : 
    - Alignement de tous les experts sur le top mondial des modèles locaux (Gemma 4, Qwen 2.5, DeepSeek-R1).
    - Mise en place du mode discussion amont (Brainstorming) pour affiner les projets.
- **Statut** : Version la plus stable et intelligente à ce jour.


## [2026-04-10] v2.0-Standalone - La Grande Mutation
- **Action** : Refonte totale de l'architecture.
- **Détails** : Migration de PHP à une architecture Full-Stack Node/React.
- **Nouveautes** :
    - Création de l'interface Liquid Glass (React).
    - Initialisation du serveur Node.js souverain.
    - Implémentation du Project Builder (créateur de fichiers physique).
- **Statut** : Opérationnel.

## [2026-04-09] v1.5-Stabilisation EasyLocalAI
- **Action** : Optimisation du routage des experts.
- **Résultat** : Réduction de la latence et meilleure spécialisation des réponses.

## [2026-04-07] v1.0-Vision Initiale
- **Concept** : Création d'une station de travail autonome inspirée de la méthode BMAD.
- **Design** : Premier jet du thème Liquid Glass.
