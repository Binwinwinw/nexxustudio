# Architecture de Chargement par Couches

## Décision

Nexxus adopte explicitement une stratégie de chargement progressif par couches pour réduire le coût des requêtes simples et réserver les chargements lourds aux tâches qui en tirent une vraie valeur.

Cette décision a été formalisée le 2026-04-27 après plusieurs ajustements sur :

- le routage d'experts ;
- l'hydratation paresseuse des profils experts ;
- le chargement gouverné des documents ;
- la télémétrie de tour pour mesurer le coût réel des couches activées.

## Objectifs

- garder un démarrage léger ;
- éviter de charger trop de contexte trop tôt ;
- limiter le bruit cognitif injecté au modèle ;
- rendre observable le coût de chaque étape ;
- préserver de bonnes performances sur les échanges simples ;
- garder une montée en puissance propre sur les demandes complexes.

## Couches définies

### L0_BOOTSTRAP

Chargement au démarrage des manifests experts légers :

- identité de l'expert ;
- division ;
- description ;
- scope ;
- usages recommandés ;
- chemin vers le fichier expert complet.

Cette couche ne doit pas embarquer les prompts lourds si ce n'est pas nécessaire.

### L1_LEXICAL_ROUTING

Pré-sélection rapide des candidats via index lexical statique :

- BM25 ;
- tokenisation technique ;
- budget borné de candidats.

But : décider vite quels experts valent la peine d'être examinés plus finement.

### L2_COGNITIVE_SELECTION

Réduction des candidats par arbitrage cognitif :

- top candidats issus de L1 ;
- intervention du master orchestrator ;
- plan stratégique éventuel ;
- budget borné de candidats finaux.

But : ne garder que les experts réellement utiles pour le tour courant.

### L3_EXPERT_HYDRATION

Réveil ciblé d'un expert complet uniquement quand il est demandé :

- lecture du fichier source expert ;
- récupération du prompt complet ;
- enrichissement runtime.

But : ne pas charger tous les prompts complets au boot.

### L3_DOCUMENT

Chargement gouverné paresseux des documents :

- cache hit si déjà chargé ;
- lazy load sinon ;
- usage réservé aux sujets détectés par le routeur de connaissance.

But : ne lire les documents de référence qu'au moment où ils sont réellement pertinents.

### L4_MODEL_STREAMING

Pilotage des modèles lourds en streaming :

- activation explicite via `USE_AIRLLM=true` ;
- **Séparation Chat/Forge** : usage de modèles 4B/8B pour le chat/discussion et 14B+ pour la Forge ;
- **Classification par Nature (v2.9.1)** :
    - **THINKERS** (ex: DeepSeek-R1) : Modèles de raisonnement profond, autorisés à utiliser des blocs `<think>` avec une température de 0.6.
    - **ACTORS** (ex: Qwen-Coder) : Modèles d'exécution directe, bridés en température (0.2) pour une précision maximale, avec suppression automatique des balises de réflexion.
- **Streaming Différencié** :
    - `onChunk` : Envoi du texte nettoyé vers le Chat en temps réel.
    - `onThought` : Envoi du raisonnement complet (`<think>`) vers la Console d'Orchestration une fois finalisé.

Modèles retenus pour le routage :

- `deepseek-r1:14b` (Forge Reasoner) — puissance brute pour production et audits finaux ;
- `deepseek-r1:8b` (Chat Reasoner / Mentor) — analyse complexe en phase de discussion sans latence lourde ;
- `qwen3.5:4b` (Chat Fast / Orchestrator) — réactivité instantanée pour l'assistant social et le routage interne ;
- `qwen3.5:9b` (Social) — qualité supérieure pour le Mentor Discovery et les échanges longs ;
- `starcoder2:15b` — expert Actor pour la conception technique et le code ;
- `nomic-embed-text:latest` — réservé aux embeddings, pas au chat.

But : garder le chargement lourd hors de l’échange simple. Les modèles lourds ne doivent être activés que lorsque la tâche le mérite. L'étanchéité entre la console (pensée) et le chat (réponse) est garantie.

## Budgets actuels

- bootstrap fichiers : 64 max ;
- candidats lexicaux : 5 max ;
- candidats cognitifs : 3 max ;
- hydratations expertes par tour : 2 max.

Ces budgets ne sont pas des vérités absolues. Ils servent de garde-fous de performance.

## Télémétrie associée

Une télémétrie de tour a été ajoutée pour produire une synthèse par requête :

- couches activées ;
- durée totale ;
- nombre de candidats lexicaux ;
- nombre de candidats cognitifs ;
- nombre d'experts hydratés ;
- documents chargés ;
- cache hits ;
- réparations déclenchées ;
- récupérations visibles ;
- fallbacks utilisés.

Format attendu :

```text
[Telemetry][completed] durationMs=... layers=... lexical=... cognitive=... hydrated=... docs=... cacheHits=... repairs=... recoveries=... fallbacks=...
```

## Règle d'architecture

Une couche ne doit être conservée que si :

- son coût est identifiable ;
- son activation est justifiée ;
- son apport sur la qualité ou la stabilité est observable.

Si une couche coûte plus qu'elle ne rapporte, elle doit être réduite, retardée ou supprimée.

## Conséquence pratique

Le système ne doit plus être pensé comme "tout charger puis répondre", mais comme :

1. charger juste assez pour décider ;
2. charger ensuite juste assez pour répondre ;
3. mesurer ce qui a réellement été nécessaire.
