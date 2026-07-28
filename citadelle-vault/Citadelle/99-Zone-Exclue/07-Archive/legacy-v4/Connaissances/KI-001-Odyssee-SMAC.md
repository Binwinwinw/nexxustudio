# KI-001 : L'Odyssée SMAC - De la Défaillance à la Souveraineté

## 📋 Résumé
Ce Knowledge Item documente la transformation radicale du pipeline de réflexion de Nexxus Citadel. Suite à un échec critique de l'outil de scraping web, le système a auto-évolué pour intégrer le pattern **SMAC (Stochastic Multi-Agent Consensus)**, aboutissant à une infrastructure de décision de grade industriel.

## 🚀 Évènements Clés (04 Mai 2026)
1.  **Incident** : L'assistant Nexxus refuse d'utiliser `webSummarize` pour analyser une URL, invoquant une incapacité technique inexistante.
2.  **Diagnostic** : Désynchronisation entre l'orchestration des outils et le filtrage de sécurité (RetrievalGuard/SummaryPolicy).
3.  **Remède** : 
    *   Correction du bug de scraping (robots.txt/Headers).
    *   Implémentation d'une boucle itérative dans `agentPipeline.js`.
    *   Création de l'**ADR-003** pour définir le cadre SMAC.
4.  **Consécration** : Validation finale sur le projet **MonCoachScolaire** avec un score de maturité de 97%.

## 💡 Leçons Apprises (Insights)
*   **La Stochasticité comme Bouclier** : Utiliser des températures différentes (0.1, 0.2, 0.4) sur 3 agents experts élimine les hallucinations marginales.
*   **Gouvernance par les Seuils** : L'automatisation doit être graduée (0.75, 0.85, 0.95). Plus le risque est élevé, plus le consensus doit être fort et assisté par l'humain.
*   **L'Observabilité est Sécurité** : Un système multi-agents sans métriques p50/p95 et traces par étape est une boîte noire dangereuse.

## 🛠️ Artefacts Associés
*   [[02-Architecture/adr/ADR-003-Stochastic-Multi-Agent-Consensus|ADR-003]] : Spécifications architecturales du SMAC.
*   [[02-Procedural/SMAC-PROTOCOL-IMPLEMENTATION|Protocole d'Implémentation SMAC]] : Guide technique.
*   **Modelfiles** : Configuration Ollama alignée sur le protocole.

---
[[Bienvenue|⬅ Retour à l'Index Central]]


## 🎯 Impact Stratégique
La Citadelle dispose désormais d'un **Moteur de Vérité** local. Toute décision critique concernant la stack LAMP/Node ou Supabase est désormais soumise à ce tribunal d'experts numériques, garantissant une souveraineté et une fiabilité sans précédent.

---
*Référence : Session de maturation SMAC v3.2*
