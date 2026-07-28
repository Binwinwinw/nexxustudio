# Pipeline Épistémique (v4.6.0) - "Preuve avant Affirmation"

Ce document décrit l'architecture et le fonctionnement du Pipeline Épistémique de Nexxus Citadel, implémenté pour garantir une génération d'informations vérifiables, auditables et dépourvues d'hallucinations ("Fail-Closed").

## 1. Philosophie et Objectifs
Le pipeline est bâti sur le principe fondamental de **"Preuve avant Affirmation"**.
L'objectif est d'empêcher les modèles de langage (LLMs) de générer des réponses plausibles mais infondées (hallucinations) en séparant rigoureusement la recherche d'informations brutes, l'extraction de faits, la rédaction et la validation critique finale.

## 2. Architecture Multi-Agents du Pipeline

Le workflow est orchestré de manière séquentielle, chaque étape validant un contrat JSON (schémas Ajv) avant de passer à la suivante. L'ensemble est tracé dans `agent_audit_events`.

### Étape 1 : `RouterAgent` (Modèle rapide - qwen3.5:4b)
- **Rôle** : Qualifier l'intention de l'utilisateur et décider si le pipeline épistémique est nécessaire.
- **Sortie** : `routingDecision.schema.json`

### Étape 2 : `RetrievalAgent` (Hybride : Sémantique + Exact)
- **Rôle** : Rechercher des documents pertinents (ChromaDB, Logs, Web, Code).
- **Sortie** : `evidenceCollection.schema.json` (Tableau de `EvidenceRecord` normalisés).

### Étape 3 : `FactExtractorAgent` (Modèle rapide - qwen3.5:4b)
- **Rôle** : Lire les preuves brutes et les réduire en atomes d'information auditables.
- **Sortie** : `factExtractionBundle.schema.json` contenant des `FactRecord`, `HypothesisRecord` et `unknowns`.
- **Garde-fou** : Cet agent n'a pas le droit d'inventer des faits. S'il extrapole, il doit l'enregistrer comme "hypothèse".

### Étape 4 : `SynthesisAgent` (Rédacteur contraint - deepseek-r1:8b)
- **Rôle** : Rédiger un brouillon de réponse structuré.
- **Contrainte Épistémique** : Il ne reçoit **jamais** les preuves brutes. Il ne reçoit que le tableau de `facts` et `hypotheses`. Il est obligé de justifier chaque phrase générée en créant un objet `claim_map` qui lie le texte aux identifiants des faits (ex: `fact_ids`).
- **Sortie** : `answerDraft.schema.json`.

### Étape 5 : `CriticAgent` (Juge Veto - deepseek-r1:8b)
- **Rôle** : Évaluer la fidélité de la synthèse.
- **Mécanisme** : Pour chaque entrée de la `claim_map`, le Critic vérifie si l'affirmation est réellement supportée par le fait cité.
- **Veto (Fail-Closed)** : Si une seule affirmation certifiée (`confirmed`) s'avère non supportée ou contredite, le verdict global bascule en `rejected` (ou `rejected_precheck` si la `claim_map` est absente).
- **Sortie** : `criticReport.schema.json`.

## 3. Mécanismes de Résilience et d'Anti-Hallucination

1. **Nettoyage JSON (Anti-Surrogate / Anti-Tags)** : 
   - Suppression systématique des blocs `<think>...</think>` générés par la chaîne de pensées (ex: deepseek-r1).
   - Nettoyage des virgules terminales (`trailing commas`) avec des regex pour assurer la survie de `JSON.parse`.
2. **Fallbacks Structurés (failed_safe)** :
   - En cas de timeout, crash GPU, ou violation irrémédiable de schéma, les agents crachent un objet minimaliste valide avec `status: "failed_safe"`. Le système reste debout et l'UX n'explose pas.
3. **API Asynchrone (Polling)** :
   - Pour absorber les temps d'inférence (3-5 minutes), l'interaction se fait via `POST /api/pipeline/submit` (Fire & Forget) et `GET /api/pipeline/:job_id` (Polling).
   - Les étapes intermédiaires sont reconstituées via le `debug_trace` fourni par la base de données d'audit.

## 4. Audit Trail
Chaque décision de chaque agent est enregistrée en base de données relationnelle (`agent_audit_events`), constituant un "Audit Trail". Cela permet :
- D'exposer la transparence totale des décisions du modèle à l'utilisateur.
- De créer des métriques sur les types de rejets (`unsupported`, `misclassified`) pour calibrer la sévérité du `CriticAgent`.

---
*Ce document sert de référence technique pour l'état de l'art du pipeline épistémique au sein de Nexxus Citadel.*
