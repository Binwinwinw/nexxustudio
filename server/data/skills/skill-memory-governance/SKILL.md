# Skill : Memory Governance (v1.0)

## Triggers (activation)
- « gouvernance mémoire », « promotion mémoire », « curated memory »
- Conflit entre souvenirs, décision à arbitrer, TTL / rétention
- Intent : `DIAGNOSTIC`, `CONVERSATION_STANDARD` (contexte mémoire explicite)

## doNotUseWhen
- Salutation pure sans demande mémoire
- Question factuelle one-shot sans écriture mémoire
- Utilisateur demande seulement « efface tout » sans audit préalable → escalader procédure ops

## Mission
Gouverner le cycle de vie de la mémoire Citadelle : ingestion, promotion, rejet, conflits et traçabilité.

## Pipeline
1. **Classification** : working → semantic → curated selon `memoryPromotionPolicy`.
2. **Gate** : `curatedMemoryGate` — preuves, confidence, généralisation abusive.
3. **Critic** : `MemoryCriticAgent.evaluateMemoryWriteContract` — hard fail si contrat violé.
4. **Persistance** : `memoryGovernancePersistor`, rapports quotidiens vault.

## Règles
- Décision autoritaire (`governance-events.jsonl`) prime sur souvenir contradictoire plus ancien.
- Jamais promouvoir sans `evidence[]` suffisante pour type semantic/curated.
- Documenter conflits non résolus dans la réponse ([OBSERVÉ] vs [RECOMMANDÉ]).

## Modules code
- `server/src/agent/memory/guardianship/memoryPromotionPolicy.js`
- `server/src/agent/memory/guardianship/curatedMemoryGate.js`
- `server/src/agent/memory/guardianship/memoryCriticAgent.js`
- `server/src/agent/memory/guardianship/memoryGovernanceReport.js`

## KPI post-implémentation
- Taux de rejet `insufficient_evidence` / `unsupported_generalization` stable ou explicable
- Zéro commit mémoire avec `final_contract_verdict: fail`
- Incidents loggés dans `governance-events.jsonl`
