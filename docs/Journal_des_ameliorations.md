# Journal des Améliorations - Nexxus Studio

## [v4.5.0] - 2026-05-16 - "The Epistemic Fortress"
### Ajouté
- **Protocole de Rigueur Épistémique** : Refonte du `systemPromptBuilder` pour imposer la distinction [OBSERVÉ]/[DÉDUIT] et l'obligation de citation (ex: Log [0]).
- **Suite de Scripts Industriels** : Création de `server/src/scripts/` contenant `smoke-test.js`, `audit-guards.js`, `benchmark-epistemic.js` et `sync-memory.js`.
- **Intégration CLI** : Ajout des commandes `npm run citadel:smoke`, `audit`, `bench`, `sync`.
- **Health-Check Industriel** : Nouvel endpoint `/api/health` pour le monitoring externe.

### Corrigé
- **Détection d'Obfuscation Unicode** : Mise à jour de l'InjectionRadar pour bloquer les tentatives de bypass via caractères "boxed" (🄳🄴🅃).
- **Streaming de Pensée** : Correction de `OllamaStreamProcessor` pour éviter la perte des blocs `<think>` en fin de réponse.
- **Transparence du CriticAgent** : Durcissement des filtres contre les affirmations de VRAM/Performance non prouvées.



## [v3.1.0] - 2026-05-07 - "The Hybrid Resilience"
### Ajouté
- **Serveur AirLLM Local** : Intégration d'un serveur d'optimisation Python (port 11435) directement dans la structure `server/airllm/`.
- **Health-Check Proactif** : Le backend détecte désormais la présence d'AirLLM au démarrage pour un basculement silencieux vers Ollama en cas d'absence.
- **Orchestration Multi-Services** : Mise à jour du `npm run start` pour piloter simultanément Vite, Node.js et AirLLM Python.

### Corrigé
- **Patch de Résilience .env** : Correction chirurgicale de l'encodage UTF-16 et suppression des octets nuls bloquant Docker.
- **Alignement Dépendances** : Fixation des versions SOTA (Transformers 4.x / Optimum 1.16) pour garantir la stabilité de l'inférence shardée.

## [v3.0.0] - 2026-05-02 - "The Citadel Ascendant"
### Ajouté
- **Audit d'Impact Intégré** : Nouveau module de sécurité prédictive avec modes Fichier/Module accessible via l'UI.
- **Routage Cognitif Dynamique** : Séparation physique entre le Chat (Dialogue fluide) et la Console d'Orchestration (Raisonnement technique `<think>`).
- **Mutation de la Forge** : Remplacement du briefing textuel par un bouton d'action monumental asservi au Readiness Score (Gating à 80%).

### Optimisé
- **Hiérarchie Visuelle** : Inversion Mentor/Forge. Mentor (Chat) à gauche pour une priorité mobile et conversationnelle accrue.
- **Branding Souverain** : Passage au thème "La Citadelle" (Blanc pur / Émeraude / Verre dépoli).
- **Stabilité Backend** : Unification ESM et nettoyage des imports critiques dans `server/index.js`.

### [07/05/2026] - Industrialisation et Certification du Cockpit v3.1
- **Industrialisation** : Migration vers une architecture découplée (`useCockpitTelemetry`) et un design accessible (A11y/WCAG).
- **Gouvernance** : Implémentation de la Matrice de Priorités d'Intervention (URGENT / CONSEILLÉ / STRATÉGIQUE).
- **Certification** : Campagne d'audit réussie via `validate_cockpit_v3_1.js` et preuve matérielle visuelle.
- **État** : **SCELLÉ & GOUVERNABLE**. Jalon d'homologation atteint.

## [v2.9.1] - 2026-05-01 - "The Cognitive Mirror"
### Ajouté
- **Spécialisation par Réceptivité** : Classification des modèles en THINKER (DeepSeek) et ACTOR (Qwen-Coder).
- **Inférence Adaptative** : Température à 0.6 pour les Thinkers (réflexion) et 0.2 pour les Actors (précision).
- **Monitoring du Raisonnement** : Le flux `<think>` est désormais streamé en temps réel vers la Console d'Orchestration.
- **Auto-Bypass Social Hybride** : Correction du bug qui ignorait les questions après un "Bonjour".

### Optimisé
- **Latence de Réflexion** : Passage de 183s à 40s sur les questions complexes via le routage CHAT_REASONER (8B).
- **Étanchéité Chat/Console** : Séparation totale garantie entre la pensée brute et la réponse utilisateur.

## [v2.9.0] 2026-05-01 - Séparation Structurelle Chat/Forge (The Great Divide)
- **Modèle de Chat Ultra-Rapide** : Migration du rôle `CHAT` vers Qwen 3.5 4B, offrant une latence quasi-nulle pour l'assistant Mentor.
- **Raisonnement Gradué** : Introduction de `CHAT_REASONER` (8B) pour les analyses complexes en discussion, réservant le `FORGE_REASONER` (14B+) exclusivement aux phases de production lourde.
- **Isolation du Pipeline Chat** : Le mode Chat bypasse désormais totalement le routing L1/L2/L3 pour une réactivité optimale, tout en conservant la gouvernance d'identité.
- **Frontière de VRAM** : Stabilisation de l'empreinte mémoire en évitant le chargement accidentel de modèles 14B+ pendant les simples conversations.

## [v2.8.0] 2026-04-30 - Intégration AirLLM & Routage Dynamique
- **AirLLM Advanced Integration** : Implémentation du wrapper `airllm.js` pour le déchargement des modèles lourds vers un hôte dédié via HTTP.
- **Routage Dynamique** : Le pipeline agent utilise désormais `getClientForModel` pour basculer intelligemment entre Ollama (local léger) et AirLLM (distant lourd).
- **Contrôle de Flux** : Intégration du signal d'arrêt `stopAll()` dans tout le pipeline pour permettre l'interruption immédiate des flux de réflexion en cas de boucle ou de saturation.
- **Observabilité Accrue** : Centralisation des logs de chargement via `ensureModel` et routage explicite de l'audit et du mode VOX vers le client dynamique.
- **Architecture L4** : Validation de la couche `L4_MODEL_STREAMING` dans la documentation technique.


## [v2.2.3] 2026-04-27 - Chargement progressif & observabilité
- **Architecture clarifiée** : formalisation d'un chargement par couches pour éviter de surcharger le système dès le démarrage ou sur les requêtes simples.
- **Budgets explicites** : plafonds ajoutés sur le bootstrap, les candidats du routeur et l'hydratation d'experts par tour.
- **Hydratation ciblée** : les experts complets ne sont réveillés qu'au moment utile, au lieu d'être tous chargés de manière anticipée.
- **Connaissance paresseuse** : journalisation des `cache hit` et `lazy load` sur les documents gouvernés.
- **Télémétrie de tour** : ajout d'une synthèse par requête pour suivre les couches activées, les candidats retenus, les documents chargés et les mécanismes de secours.

## [v2.2.2] 2026-04-25 - Stabilisation du Chat Mentor
- **Régression critique évitée** : suppression des réponses vides dans le chat assistant grâce à une récupération visible plus robuste quand le stream primaire ne produit qu'un brouillon interne.
- **Qualité conversationnelle** : nettoyage de l'historique envoyé au backend pour exclure les messages assistant vides et limiter la pollution de contexte.
- **VOX contenu** : désactivation de la retranscription VOX sur les échanges mentor/discovery afin de réduire les boucles et les répétitions inutiles.
- **Fallback utile** : ajout de réponses de secours contextualisées pour les demandes d'atelier/formation Teams, avec distinction entre amorce et plan détaillé.
- **Routage plus direct** : les demandes d'accompagnement structurées (atelier, plan, objectifs, déroulé, exercices, support) évitent désormais le mode trop social de la phase discovery.

## [v2.2] 2026-04-11 - Optimisation SOTA V4 (Souveraineté Augmentée)
- **Alignement Hardware** : Implémentation d'une stratégie hybride RAM/VRAM.
    - Experts Stratégiques (PM, Architecte, Analyste) basculés sur **Gemma 4 (26B)** exploitant les 64 Go de RAM système.
    - Experts Techniques (Code, Audit) maintenus sur **Qwen 2.5 Coder (7B)** et **DeepSeek-R1 (8B)** exploitant la VRAM GPU (RTX 4060).
- **Mise à jour Experts** : Tous les experts des divisions Elite, Engineering, Design et Testing ont été alignés sur les meilleurs modèles locaux (SOTA) de 2026.
- **Support GGUF** : Ajout d'une procédure simplifiée pour l'ajout de modèles externes via Modelfile.

## [v2.1] 2026-04-11 - Mode Brainstorming
- **Nouvelle Fonctionnalité** : Ajout du bouton "BRAINSTORMING" dans l'UI.
- **Expert Analyste** : Création de l'expert `Analyst Elite` spécialisé dans l'idéation amont.
- **Logique de Dialogue** : Bypass des phases de production pour permettre un échange pur avant le lancement du chantier.
- **Fix UI** : Correction du centrage des animations orbitales (oréoles) dans la Timeline.
