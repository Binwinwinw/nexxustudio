# ADR-012 : Intégration de IBM Granite 4.1 (128K Context)

**Statut** : Expérimental / Actif
**Date** : 2026-05-16
**Auteur** : Nexxus Assistant / Antigravity

## Contexte

La Citadelle a besoin d'un "Deep Reader" capable de traiter des contextes longs (documentation technique complète, logs étendus, schémas DB massifs) sans perte de cohérence. Bien que `qwen3.5:4b` soit agile, son contexte est limité. IBM Granite 3.1 (tagué 4.1 localement) offre une fenêtre de **128K tokens**, ce qui est idéal pour les analyses transversales.

## Décision

Intégration de `granite4.1:8b` comme modèle de raisonnement de second rang (Tier 2) :

**Usage Primaire** : Analyse de documents longs et RAG complexe.

**Usage Secondaire** : Expert "Archiviste" dans le protocole SMAC ( Consensus Multi-Agents).

**Paramétrage** : `num_ctx` : Jusqu'à 128 000, `temperature` : 0.0 - 0.2 (Rigueur maximale).

## Évaluation Initiale (Benchmark 16/05/2026)

**Vitesse** : ~5.2 TPS (Lent mais stable pour du raisonnement de fond).

**Précision** : Excellente sur le suivi d'instructions (Citations de logs 100% conformes).

**Hallucinations** : Faibles lors des tests initiaux de synthèse courte.

## Conséquences

**Positives** : Capacité de lecture "Big Context" souveraine. Meilleure synthèse de documentation complexe.

**Négatives** : Consommation VRAM plus élevée lors de l'activation du contexte 128K (~5-7 GB). Latence plus élevée que Qwen.

**Risques** : Si le modèle s'avère trop lent ou hallucine sur les longs contextes (dégradation ECL observée au-delà de 32K), il sera rétrogradé ou supprimé.

---

### 🔗 Liens de Parenté

- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]]
- [[Bienvenue|⬅ Retour à l'Index Central]]
