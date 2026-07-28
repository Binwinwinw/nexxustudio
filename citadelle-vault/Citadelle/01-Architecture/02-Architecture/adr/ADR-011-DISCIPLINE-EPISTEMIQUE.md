# ADR-011 : Discipline Épistémique & Rigueur d'Observation (v4.5)

**Statut** : Approuvé
**Date** : 2026-05-16
**Auteur** : Nexxus Assistant / Antigravity

## Contexte

L'augmentation de la complexité des modèles IA (DeepSeek-R1, Qwen 3.5) a introduit un risque de "biais de complétion" : le système extrapole des états techniques (VRAM, ports, succès de boot) sans les avoir réellement vérifiés dans les logs ou le code source. Pour un système souverain de grade industriel, cette dérive est inacceptable.

## Décision

Nous implémentons une **Discipline Épistémique** stricte à travers trois couches :

**Contrat de Prompt (System Prompt)** : Interdiction de citer des chiffres ou des états sans preuve textuelle immédiate. Obligation de distinguer [OBSERVÉ], [DÉDUIT] et [RECOMMANDÉ].

**Post-Processing (CriticAgent)** : Rejet automatique des réponses "over-confident" qui ne contiennent pas de marqueurs de preuve (ex: Log [0], file:///).

**Audit Opérationnel** : Création de scripts de benchmark (`benchmark-epistemic.js`) pour mesurer mathématiquement la fiabilité des assertions de l'IA.

## Conséquences

**Positives** : Élimination quasi-totale des hallucinations techniques. Transparence accrue pour l'opérateur humain.

**Négatives** : Légère augmentation de la latence (post-processing du CriticAgent). Réponses parfois plus verbeuses à cause des citations obligatoires.

**Risques** : Le système pourrait devenir trop "prudent" (over-blocked). Ajustement nécessaire via le SMAC Gate.

---

### 🧬 Références & Origines

- [[04-Operations/procedures/MANUEL-MAINTENANCE-V4.5|🛠️ Manuel de Maintenance Industrielle]]
- [[01-Strategy/LTM-Methodology/EPISODE-CITADEL-PERSONA-HARDENING-001|🛡️ Épisode 001 : Durcissement du Persona]]
- [[01-Strategy/LTM-Methodology/EPISODE-CITADEL-DISCOVERY-DOCTRINE-001|📜 Épisode 002 : Doctrine Discovery vs Forge]]

---

### 🔗 Liens de Parenté

- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]
