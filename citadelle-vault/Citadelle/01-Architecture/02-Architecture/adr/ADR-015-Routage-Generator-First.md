# ADR-015 : Routage "Generator-First" pour les Artefacts Longs

## Statut
**Validé** (24 Mai 2026)

## Contexte
La Forge de La Citadelle repose sur une architecture multi-agents séquentielle (`expert_pm` -> `expert_architect` -> `expert_developer` -> `expert_qa`). Cette gouvernance permet d'affiner les concepts complexes avant la production. 
Cependant, pour les tâches de pur "mass-authoring" (ex: générer 20 slides HTML, écrire un JSON massif), cette séquence métacognitive se transforme en dette temporelle : l'orchestrateur brûle son budget temps à décrire la structure (l'idéation) au lieu d'émettre le code, ce qui engendre régulièrement des timeouts réseaux (1 200 000 ms) ou le "syndrome du toy example".

## Décision
Nous introduisons un **bypass orchestral (Generator-First)** déclenché dynamiquement lors de la soumission de la requête.

### Critères d'entrée
Le mode `generatorFirst` s'active si la demande utilisateur requiert un livrable explicite, massif et déterministe, avec peu d'ambiguïté fonctionnelle.
- **Exemples validés :** "Crée un fichier index.html complet de 20 slides", "Génère un dataset JSON massif avec 1000 entrées", "Livrable déterministe complet".
- **Exemples rejetés (Requêtes planificatrices) :** "Comment structurer mon architecture ?", "Planifie une présentation", "Brouillon de concept".

### Implémentation
1. **Classification Amont :** Le frontend (`App.jsx`) évalue le `projectGoal` via une regex ciblant les marqueurs de longs livrables.
2. **Bypass des Phases Bavardes :** Si le mode `generatorFirst` est actif, le tableau des phases est réduit à `["expert_developer", "expert_qa"]`. Les étapes `expert_pm` et `expert_architect` sont sautées.
3. **Maintien du Contrôle Qualité :** La phase `expert_qa` est conservée MAIS son contrat est ultra-court : elle ne s'autorise aucune re-planification ni réinterprétation. Son seul rôle est de valider l'intégrité structurelle de l'artefact (cf. Guard `isIllusionOfCompleteness`).
4. **Feature Flag :** L'activation du bypass est traitée comme un feature flag interne (journalisé dans le Cockpit) permettant un rollback facile.

## Conséquences
### Positives
- **Baisse drastique des timeouts** : L'allocation de temps et de tokens se concentre immédiatement sur l'émission physique de l'artefact.
- **Suppression du bruit métacognitif** : Disparition du comportement "je planifie à voix haute pendant 10 minutes".
- **Préservation de "Blueprint Before Forge"** : Le bypass n'intervient que pour les tâches où le blueprint est implicite ou spécifié par l'utilisateur (le travail de l'Architecte est déjà fait).

### Négatives / Compromis
- L'expert QA pourrait être tenté de rouvrir un débat architectural si le livrable est mal formé. (Mitigation: durcissement des `qualityGuards` backend pour interdire la métacognition QA, sanction d'illusion_of_completeness).
- Si cette itération Generator-First ne suffit pas à endiguer les timeouts sur les très grandes générations (>100k tokens), il faudra procéder à une **seconde décision technique (ADR-016)** pour implémenter un streaming par chunks (Continuity Protocol).
