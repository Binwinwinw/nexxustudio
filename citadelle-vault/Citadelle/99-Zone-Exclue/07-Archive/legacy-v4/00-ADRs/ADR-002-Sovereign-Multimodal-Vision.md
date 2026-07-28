# ADR-002 : Sovereign Multimodal Vision

**Date** : 2026-05-03  
**Statut** : ✅ Validé  
**Expert** : Nexxus (Maître Orchestrateur)

## Contexte
La Citadelle nécessitait une capacité de compréhension visuelle pour traiter les captures d'écran techniques, les diagrammes d'architecture et les documents OCR sans dépendre de services cloud tiers. L'objectif était de maintenir la souveraineté totale des données tout en offrant une analyse de niveau industriel.

## Décision
Implémentation d'un pipeline de vision locale hybride (`imageAnalyzer.js`) :
1. **Normalisation** : Utilisation de `sharp` pour le redimensionnement et l'optimisation des ressources.
2. **OCR Local** : Intégration de `Tesseract.js` (mode worker) pour l'extraction textuelle robuste en français et anglais.
3. **Analyse Multimodale** : Utilisation de `qwen3-vl:8b` via Ollama pour la description sémantique et contextuelle de l'image.
4. **Injection Cognitive** : Automatisation de l'envoi des résultats d'analyse au Maître Orchestrateur pour une prise de décision éclairée.

## Conséquences
- **Vision Souveraine** : Capacité d'analyser des UI, des logs et du code à partir d'images sans sortie de données.
- **Réactivité** : Pré-chargement du modèle multimodal via `warmupService`.
- **Expérience Utilisateur** : Ajout d'un point d'entrée physique (upload) dans le `ChatBento`.

---
### 👁️ Synergies de Vision
- [[02-Architecture/adr/ADR-004-Security-Hardening|🔒 Sécurisation des sessions Vision]]
- [[05-Knowledge/heritage/Composants-Souverains|🧱 Composants Souverains]] (Normalisation Sharp)
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]] (Rigueur d'analyse)

---
### 🔗 Liens de Parenté
- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]

