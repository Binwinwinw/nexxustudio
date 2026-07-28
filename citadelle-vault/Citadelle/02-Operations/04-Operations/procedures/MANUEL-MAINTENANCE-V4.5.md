# Manuel de Maintenance Industrielle (v4.5)

Ce document décrit les procédures de maintenance de La Citadelle à l'aide de la nouvelle suite de scripts opérationnels.

## 1. Diagnostic Rapide (Smoke Test)
En cas de doute sur l'état du système, lancez un test d'intégrité global.
```bash
npm run citadel:smoke
```
**Indicateurs critiques :**
- `Nexxus Core` doit être `🟢 ONLINE`.
- `Ollama` doit répondre en moins de 50ms.

## 2. Audit de Sécurité (Guard Audit)
Après toute modification du code source ou mise à jour de modèle, vérifiez que les boucliers tiennent toujours.
```bash
npm run citadel:audit
```
Ce script teste les injections de prompt et les tentatives d'obfuscation.

## 3. Benchmark de Vérité (Epistemic Bench)
Si vous constatez que l'agent commence à "inventer" des données techniques (hallucinations), lancez le benchmark de rigueur.
```bash
npm run citadel:bench
```
Un score inférieur à 0.85 indique un besoin de recalibrage du `CriticAgent` ou du `SystemPrompt`.

## 4. Nettoyage et Synchronisation
Pour purger les sessions mortes et garantir que ChromaDB est aligné avec le disque.
```bash
npm run citadel:sync
```
*Fréquence recommandée : Une fois par jour ou après une session de tests intensifs.*
