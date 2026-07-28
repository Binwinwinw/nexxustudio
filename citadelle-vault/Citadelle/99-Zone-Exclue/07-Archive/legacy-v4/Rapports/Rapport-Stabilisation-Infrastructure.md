# Rapport de Stabilisation : Infrastructure Hybride v3.1

**Date** : 2026-05-07
**Statut** : OPÉRATIONNEL
**Auteurs** : Nexxus Architect & Opérateur

## 1. Contexte
Lors de l'activation du module **Caveman** et du benchmark de tokens, une instabilité critique a été identifiée au niveau de la couche d'optimisation **AirLLM** et de la gestion des fichiers de configuration `.env`.

## 2. Actions Correctives (Hardening)

### 2.1 Couche LLM (AirLLM)
- **Problème** : Inaccessibilité du port 11435 et conflits de bibliothèques Python (Transformers 5.x).
- **Solution** : 
    - Intégration d'un serveur local FastAPI dans `server/airllm/`.
    - Downgrade contrôlé vers `transformers==4.57.6` et `optimum==1.16.2`.
    - Ajout d'une sonde de santé (Health Check) dans `llmFactory.js`.

### 2.2 Système (Configuration)
- **Problème** : Encodage UTF-16 du fichier `.env` provoquant des échecs Docker (`unexpected character \x00`).
- **Solution** : Conversion forcée en UTF-8 et purge des octets nuls via script chirurgical.

## 3. Architecture Cible (Souveraineté)
La Citadelle utilise désormais une orchestration à 3 piliers via `npm run start` :
1.  **Backend (Node.js)** : Gestion des agents et du RAG.
2.  **Frontend (Vite)** : Interface souveraine.
3.  **Optimizer (Python)** : Inférence shardée via AirLLM pour les modèles lourds (30B+).

## 4. Prochaines Étapes
- [ ] Valider le benchmark de vitesse sur un modèle 14B+ (DeepSeek).
- [ ] Finaliser l'intégration du mode Caveman Ultra pour la compression sémantique.
