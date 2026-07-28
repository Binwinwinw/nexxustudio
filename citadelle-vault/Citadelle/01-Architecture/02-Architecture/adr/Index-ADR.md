# 🗺️ Atlas des Décisions d'Architecture (ADR)

Cet Atlas répertorie les gènes structurels de La Citadelle. Chaque document ici présent justifie un choix technique ou une orientation stratégique.

## 🏛️ Fondations & Manifestes
- [[ADR-008.1-Manifest-v3.1|📜 Manifeste de Configuration v3.1]] : Le noyau actuel de l'orchestrateur.
- [[ADR-001-Web-Consciousness|🌐 Web Consciousness]] : Origines de la conscience agentique.
- [[ADR-007-Skills-Architecture|🛠️ Architecture des Skills]] : Chargement dynamique des capacités.

## 🛡️ Gouvernance & Sécurité
- [[ADR-20260528-Triangle-Gouvernance-Humain-IA-Citadelle|🔺 Triangle Humain — IA — Citadelle]] : Doctrine de gouvernance et boucle preuve/jugement.
- [[ADR-005-Sovereign-Safety-Governance|⚖️ Gouvernance de Sécurité Souveraine]] : Fondement des gardes-fous.
- [[ADR-004-Security-Hardening|🔒 Durcissement de la Sécurité]] : Protocoles de défense.
- [[ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ Discipline Épistémique (v4.5)]] : Rigueur d'observation et preuves.
- [[ADR-009-Security-Hardening-CSP-SRI|🛡️ Sécurité Frontend (CSP/SRI)]] : Protection de l'interface.

- [[ADR-003-Knowledge-Governance|📚 Gouvernance de la Connaissance]] : Gestion du RAG et du Vault.

## 🧠 Intelligence & Mémoire
- [[ADR-006-Sovereign-Memory-Bridge|🌉 Pont de Mémoire Souveraine]] : Persistance et ChromaDB.
- [[ADR-20260605-Document-Continuity|📎 Continuité documentaire de fil]] : `active_document_inherits_on_followup` — suivi sur document déjà analysé.
- [[ADR-20260606-Session-Document-Briefing-Persistence|💾 Persistance session document_briefing]] : 📋 proposé — survie au redémarrage Node (si terrain le justifie).
- [[ADR-20260607-Refusal-Sufficiency|🛡️ Suffisance avant refus épistémique]] : Réponse utile minimale avant refus — procédure Forge/projet.
- [[ADR-20260604-Auto-Reply-Sufficiency|⚡ Suffisance des auto-réponses]] : Règle transversale — clôture seulement si suffisance totale.
- [[ADR-20260603-Web-Candidate-Memory|🌐 Mémoire candidate Web (P0)]] : Épisode → candidate → promotion gouvernée (fail-closed).
- [[ADR-002-Sovereign-Multimodal-Vision|👁️ Vision Multimodale]] : Intégration de Qwen-VL.
- [[ADR-003-Stochastic-Multi-Agent-Consensus|🎲 Consensus Multi-Agents]] : Stratégie de décision stochastique.

## 🚀 Performance & Futur
- [[ADR-010-Frontend-Performance-Strategy|⚡ Stratégie Performance Frontend]] : Optimisation VRAM et Latence.
- [[ADR-008-Benchmark-SOTA|📊 Benchmarks SOTA]] : Critères d'excellence.
- [[ADR-004-Continuity-Protocol|🔄 Protocole de Continuité]] : Résilience des sessions.
- [[ADR-20260527-Intent-Contract-Registry|📋 Intent Contract Registry]] : Routage intent → contrat → validation.
- [[ADR-20260527-Stack-Familiarite-Trois-Temps|🤝 Stack familiarité trois temps]] : subject understanding, lexique vivant, P3 borné.
- [[ADR-20260627-Query-Understanding-G29-v1|🧩 Query Understanding G29]] : lecture multi-segment, plan gouverné, registre domaines.
- [[ADR-20260627-Guided-Product-Recommendation-G31-v1|📱 G31 — Reco produit guidée]] : slots budget/usage, web borné, validator.
- [[ADR-20260627-Guided-Document-Synthesis-G32-v1|📄 G32 — Synthèse document guidée]] : groundedness, pas de web, validator post-compose.

## 📡 Roadmap 2026 — Prouver avant d'ouvrir (juin 2026)
- [[ADR-20260530-Traces-MVP-Correlées|🔗 Traces MVP corrélées]] : trace_id, spans JSON, evals sortie (M1).
- [[ADR-20260601-Bootstrap-Readiness-Sondes|🏥 Bootstrap & sondes live/startup/ready]] : boot_trace_id, warmup, script opérateur (M1-S2).
- [[ADR-20260601-Memoire-Fil|🧵 Mémoire de fil]] : session DB, rappel Tier 2, grounding (M2 — en cours).
- [[ADR-20260601-Micro-Conversation-Delestage|⚡ Micro-délestage conversationnel P1]]
- [[ADR-20260601-Nexxus-Video|🎬 Nexxus Video]] : intelligence vidéo multimodale, job async (scaffold v1).
- [[ADR-20260601-Suite-Design-Nexxus|🎨 Suite Design]] : Nexxus Design, Impeccable, Design Extract.
- [[Index-Skills-Runtime-2026|📋 Index Skills Runtime 2026]] : photographie opérationnelle skills + priorités.
- [[Browser-Harness-Phase-C|🌐 Browser Harness Phase C]] : spec observation local-only (getComputedStyle).
- [[ADR-20260530-API-v1-InferenceProvider|🔌 API v1 + InferenceProvider]] : Contrats stables avant connecteurs (M2 spec, M5 impl).

---
### 🔗 Connexions Globales
- [[Bienvenue|⬅ Retour à l'Index Central]]
- [[00-Foundation/VAULT-GOVERNANCE|📐 Gouvernance du Vault]]
- [[Cockpit-v3-1|🚀 Pilotage Opérationnel]]
