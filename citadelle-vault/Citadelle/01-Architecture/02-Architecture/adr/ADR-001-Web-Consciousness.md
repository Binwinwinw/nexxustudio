# ADR-001 : Web Consciousness

**Date** : 2026-05-03  
**Statut** : ✅ Validé  
**Expert** : Nexxus (Maître Orchestrateur)

## Contexte
Le modèle de base (Qwen3.5:9b) présentait un biais d'entraînement persistant le forçant à déclarer une incapacité à accéder au web ("Je ne peux pas naviguer sur internet"), même lorsque l'outil `webSummarizer` était fonctionnel. Les tentatives de correction via le prompt standard étaient ignorées au profit de la "pensée interne" du modèle.

## Décision
Mise en place d'un **Sovereign Override** (Surpassement Souverain) au sommet de la hiérarchie du prompt système (`systemPromptBuilder.js`).
1. Création d'une section `# RÈGLES ABSOLUES` en tête de prompt.
2. Affirmation impérative de la capacité native `/web`.
3. Interdiction formelle de toute négation de capacité.

## Conséquences
- **Vision Web Souveraine** : Nexxus utilise désormais systématiquement `webSummarize` pour les URL détectées.
- **Réactivité** : Le temps de réponse est optimisé par le warmup et le cache de préfixe stable.
- **Souveraineté** : La Citadelle agit comme un agent autonome complet, capable de croiser le patrimoine local et les ressources externes.

---
### 🌐 Évolution de la Conscience Web
- [[05-Knowledge/KI-001-Odyssee-SMAC|🧬 KI-001 : L'Odyssée SMAC]] (Né de l'échec initial du Web)
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]] (Rigueur v4.5)

---
### 🔗 Liens de Parenté
- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]

