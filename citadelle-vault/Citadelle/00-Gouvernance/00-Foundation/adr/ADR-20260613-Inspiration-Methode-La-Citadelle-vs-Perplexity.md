# ADR-20260613-Inspiration-Methode-La-Citadelle-vs-Perplexity

**Statut** : proposé  
**Créé le** : 2026-06-13  
**Domaine** : foundation / architecture  

## Titre
Inspiration de Méthode — La Citadelle vs Perplexity

## Résumé
La Citadelle ne vise pas à devenir Perplexity, ChatGPT, ou un assistant généraliste cloud.
L’objectif est d’absorber la méthode de gouvernance (décision structurée, capacités nommées, tests de non-régression, ADR) et de l’appliquer avec l’ADN natif de Nexxus : local, souverain, frugal, réactif.

Ce ADR formalise la frontière conceptuelle entre :
- méthode à copier (gestion de la décision, architecture durable, traçabilité) ;
- produit à ne pas copier (cloud, modèle centralisé, généralisme sans garde-fous).

## Contexte
Nexxus évolue dans un écosystème où :
- la latence, la VRAM, et le local-first sont des contraintes réelles ;
- la souveraineté et la frugalité sont des valeurs de conception ;
- la doctrine réactive (détection → routage → contrat → fail-closed) est déjà en place.

En parallèle, les pratiques observées chez Perplexity (et assistants skeptiques modernes) montrent une méthode efficace :
- capacités gouvernées plutôt que patches isolés ;
- chaîne de décision qui impose le comportement, pas le LLM ;
- tests de non-régression et ADR pour figer les décisions.

Le risque est de vouloir “copier le produit” (Perplexity-like) plutôt que “copier la méthode” (gouvernance, architecture, traçabilité).

## Problème
Sans ADR explicite, La Citadelle pourrait :
- glisser vers une copie produit : chercher à ressembler à un assistant généraliste cloud ;
- perdre son ADN : local, souverain, frugal, réactif ;
- dériver vers des solutions inadaptées :
  - modèles cloud lourds ;
  - généralisme sans garde-fous ;
  - architecture non réactive, non réjouable.

Le but est donc de clarifier la frontière :
- ce qu’on copie : la méthode ;
- ce qu’on ne copie pas : le produit.

## Décision

### Ce que La Citadelle copie (méthode)
La Citadelle adopte explicitement les principes suivants, inspirés de Perplexity :

**Décision gouvernée end-to-end**
- détection → routage → contrat → fail-closed ;
- le LLM est contraint par la chaîne, pas l’autorité du comportement.

**Capacités nommées, pas patches isolés**
- chaque correction devient une capacité : ARCHITECTURE_OPTIONS, stack familiarité, multi-tour, memory hub ;
- pas de “rustine prompt” sans gouvernance.

**Tests de non-régression et smoke registries**
- chaque capacité est validée par des tests rejouables ;
- le comportement est protégé contre les breakages silencieux.

**ADR et traçabilité dans le Vault**
- chaque décision majeure est figée dans un ADR ;
- la doctrine est écrite, exécutable, et traçable.

**Architecture durable, low-redundancy**
- privilégier une architecture stable à long terme ;
- éviter les corrections locales successives et le reasoning redondant.

### Ce que La Citadelle ne copie pas (produit)
La Citadelle refuse explicitement ces dimensions :

**Cloud et modèle centralisé**
- pas de dépendance à un modèle centralisé ;
- Nexxus reste local-first, avec Ollama et modèles tiers locaux.

**Généralisme sans garde-fous**
- Nexxus n’est pas un assistant “tout sait, tout fait” ;
- il est expert, gouverné, réactif, avec des garde-fous épistémiques.

**Latence et coût cloud**
- pas de modèle de latence cloud, pas de coût par token externe ;
- l’architecture est calibrée pour la rapidité locale (doctrine reactive).

**Architecture non réactive**
- Nexxus ne suit pas un modèle “réfléchis long, réponds gentil” ;
- il est réactif : prêt vite, intelligent progressivement, déterministe quand c’est possible.

## Conséquences

### Conséquences architecturales
La Citadelle continue de :
- gouverner le comportement par la chaîne, pas par le LLM ;
- transformer les symptômes en capacités nommées ;
- figer les décisions dans ADR + tests ;
- privilégier l’architecture durable, low-redundancy ;
- maintenir la doctrine réactive (tier 1 prêt vite, tier 2 amorcé en fond).

La Citadelle ne cherchera pas :
- à devenir un assistant généraliste cloud ;
- à imiter Perplexity dans son produit ;
- à dépendre de modèles cloud ou de coûts externes.

### Conséquences opérationnelles
Tous les nouveaux chantiers (Knowledge Hub, audit de code à grande échelle, etc.) doivent :
- respecter la doctrine réactive ;
- être conçus comme capacités nommées ;
- être accompagnés de tests de non-régression ;
- être documentés dans un ADR si décision majeure.

### Conséquences culturelles
La Citadelle assume pleinement son ADN : local, souverain, frugal, réactif, gouverné.
Elle s’inspire de Perplexity sur la méthode, mais ne cherche pas à devenir Perplexity.

## Critères de succès
Ce ADR est respecté si :
- Chaque nouvelle correction est :
  - une capacité nommée, pas un patch ;
  - validée par des tests rejouables ;
  - documentée dans le Vault (ADR ou playbook).
- Nexxus ne cherche pas :
  - à devenir un assistant généraliste cloud ;
  - à copier le produit Perplexity ;
  - à dépendre de modèles cloud.
- L’architecture reste :
  - réactive ;
  - low-redundancy ;
  - gouvernée par la chaîne, pas par le LLM.
- La doctrine réactive est appliquée :
  - tier 1 prêt vite ;
  - tier 2 amorcé en fond ;
  - comportement déterministe quand possible.

## Liens transverses
- [[ADR-20260603-Web-Candidate-Memory]] (mémoire d’expérience gouvernée)
- P5 v1 (élan conversationnel déterministe, neutralité → orientation active)
- Stack Familiarité (subject understanding → lexique vivant → LLM compresseur)
- Memory Hub & Continuité (PR1–PR4, extraction de connaissances, promotion de faits)
- Doctrine Reactive (boot agressif, tier 1 prêt, tier 2 deferred)

## Verdict
Ce ADR établit la frontière conceptuelle entre :
- **méthode à copier** : gouvernance, capacités, tests, ADR ;
- **produit à ne pas copier** : cloud, généralisme, modèle centralisé.

La Citadelle assume pleinement son ADN : local, souverain, frugal, réactif, gouverné.
Nexxus s’inspire de Perplexity pour sa méthode, mais ne devient pas Perplexity.
