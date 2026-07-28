# 🎖️ Rapport de Certification Nexxus Citadel

- **ID de Build** : `NX-MQTXD0PE`
- **Date** : 25/06/2026 15:58:26
- **Santé Souveraine** : 75%
- **Statut Global** : ❌ RÉGRESSION DÉTECTÉE

## 📊 Résumé Cockpit
> `Citadel [NX-MQTXD0PE] : 75% Health - REGRESSION DETECTED`

## 🔍 Détail des Suites

| Niveau | Fichier | Description | Statut | Durée |
| :--- | :--- | :--- | :--- | :--- |
| SMOKE | `smoke.test.js` | Vérification du boot et des imports | ✅ | 445ms |
| CERTIFICATION | `expertRouter_modular.test.js` | Validation des contrats ExpertRouter | ✅ | 277ms |
| CERTIFICATION | `systemPromptBuilder.test.js` | Validation de l'assemblage souverain | ❌ | 491ms |
| EXTENDED | `extended_governance.test.js` | Stress VRAM et limites de gouvernance | ✅ | 260ms |

## 📝 Journal des Assertions

### smoke.test.js
- ✅ ExpertRouter module loaded.
- ✅ Ollama LLM module loaded.
- ✅ ManifestStore module loaded.
- ✅ Nexxus Curator manifest extraction is functional.

### expertRouter_modular.test.js
- ✅ RRF(0,0) should be around 0.033. Got: 0.03333333333333333
- ✅ Cold model in CRUISE should have moderate penalty. Got: 0.175
- ✅ P3 Cold in RESTRICTED should be -1.0. Got: -1
- ✅ P1 in PANIC should be protected (0.15). Got: 0.15
- ✅ Final score calculation for ideal HOT expert should be 0.96. Got: 0.96
- ✅ Final score for busy HOT expert should be 0.76. Got: 0.76
- ✅ Balanced hybrid (5,5) should score higher than skewed (1,10) in RRF. Got: B=0.0313, A=0.0312

### systemPromptBuilder.test.js
*Aucune assertion détaillée disponible.*

### extended_governance.test.js
- ✅ Cruise score for cold is positive.
- ✅ Restricted mode correctly blocks P3 cold.
- ✅ Panic mode correctly blocks P3 cold.
- ✅ P1 HOT remains highly viable even under high context pressure (RESTRICTED).

