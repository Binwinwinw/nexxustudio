# Vague 2 — Observabilité & Calibration (Fiabilité v3.5)

Objectif : industrialiser la confiance en passant de la **protection par garde-fous** (Vague 1) à la **gestion active** de la fiabilité, via instrumentation, taxonomie d’échecs, calibration de la confiance et détection de dérive.  
Cible : pouvoir dire non seulement “La Citadelle est fiable en test”, mais “nous savons **quand**, **où** et **pourquoi** elle devient trop prudente, trop lente ou mal calibrée”.

---

## Tâche 1 — Traces complètes

- Instrumenter chaque tour de La Citadelle avec une **trace d’exécution complète** contenant :
  - entrée utilisateur (prompt, type de tâche, projet cible) ;
  - sources de vérité chargées (ADR‑003, `handoff.json`, `package.json`, etc.) ;
  - outils potentiellement appelés ou invoqués ;
  - résultat du Critic Agent (accepté / rejeté / auto‑corrigé, motif) ;
  - résultat du Syntax Proxy (code valide / invalide) ;
  - score SMAC et décision de publication (direct / Hypothèse Prudente / bloqué).

- Stocker ces traces dans un emplacement structuré, par exemple :  
  `server/data/logs/reliability/YYYY-MM-DD/turn-<id>.json`.

- Exiger que toute décision critique (architecture, sécurité, code) soit traçable de bout en bout, y compris en cas de re‑évaluation SMAC.

> Effet attendu : capacité à reconstituer l’arbre complet de décision pour toute réponse bloquée, modifiée ou publiée.

---

## Tâche 2 — Taxonomie d’échecs

- Créer une **taxonomie de rejet unique et stable**, exposée comme un enum dans le système, par exemple :

  - `unsupported_claim` : affirmation d’un état non sourcé (fichier, scan, outil).  
  - `ghost_tool` : outil cité mais absent du `toolRegistry`.  
  - `missing_observed_evidence` : structure réelle présentée comme observée sans preuve.  
  - `blueprint_build_confusion` : mélange entre structure théorique (Blueprint) et réelle (Build).  
  - `syntax_invalid` : bloc de code refusé par le Syntax Proxy.  
  - `output_contract_incomplete` : réponse sans bloc `OBSERVÉ` / `DÉDUIT` / `RECOMMANDÉ` complet.  
  - `smac_low_confidence` : score SMAC < 0.75, donc bascule en mode “Hypothèse Prudente”.  
  - `critic_false_positive_suspected` : auto‑correction déclenchée mais revue humaine ultérieure jugée inutile.

- Ajouter cette taxonomie au rapport d’événements exporté dans `turnTelemetry.js` et au Cockpit.

> Effet attendu : capacité à distinguer une vraie hallucination bloquée d’un faux positif du Critic, et à prioriser les améliorations.

---

## Tâche 3 — KPIs de fiabilité

- Définir une **série de KPIs minimale** calculée à partir des traces, par tour et par journée :

  - `Taux_Publication_Primal` : % de réponses publiées directement, sans re‑évaluation.  
  - `Taux_Rejet_Critic` : % de réponses rejetées / corrigées par le Critic.  
  - `Taux_Hypothese_Prudente` : % de réponses en mode “Hypothèse Prudente”.  
  - `Taux_Echec_Syntax` : % de blocs de code refusés par le Syntax Proxy.  
  - `Latence_Fiabilité` : temps moyen ajouté par Critic + Proxy + Discordance.  
  - `Taux_Rejet_Total` : % de tours terminés sans réponse publiable.  
  - `Score_SMAC_Moyen` : moyenne des scores SMAC par type de tâche.

- Expose ces métriques dans un format simple (JSON, Prometheus ou similaire) pour agrégation dans le Cockpit ou un outil de monitoring.

> Effet attend aussi : repérage rapide de “sur-blocage” ou de sur‑prudence, sans perte de pertinence métier.

---

## Tâche 4 — Dashboard cockpit (Santé opérationnelle / épistémique)

- Créer un **Dashboard Vague 2** dans le Cockpit organisé en trois vues principales :

  - **Santé opérationnelle**  
    - Latence p50 / p95,  
    - Taux de rejet / fallback / Hypothèse Prudente,  
    - Taux de throughput (tours/min),  
    - Volume de logs et taille de stockage.

  - **Santé épistémique**  
    - Répartition des types d’erreurs (`unsupported_claim`, `ghost_tool`, etc.),  
    - Part de réponses en `OBSERVÉ` vs `DÉDUIT`,  
    - Part de blocs de code effectivement utilisés par l’utilisateur vs refusés.

  - **Santé de calibration**  
    - Distribution du score SMAC,  
    - Densité d’erreurs par tranche de confiance,  
    - Indicateur simple `confiance_vs_justesse` (ex: ratio corrects par tranche de score).

- Limiter le nombre de graphiques clés à 8–12, afin de ne pas noyer l’opérateur humain.

> Effet attendu : l’équipe peut voir en un coup d’œil si La Citadelle devient trop prudente, trop lente, ou si certains motifs de rejet dominent.

---

## Tâche 5 — Vérité terrain (Ground Truth Review)

- Mettre en place un **mécanisme de revue humaine** sur un échantillon représentatif de réponses, par exemple 5–10 % des tours critiques :

  - Pour chaque réponse échantillonnée, une revue courte (1–2 minutes) par un opérateur qualifié.  
  - Attribution d’un label :  
    - `correct`,  
    - `partiellement_correct`,  
    - `incorrect`,  
    - `overblocked` (trop de prudence, perte de valeur).

- Lier chaque label de vérité terrain à la trace associée, puis enrichir la base de tests `reliability_tests` avec les cas les plus frappants.

- Ne pas utiliser la vérité humaine comme “moteur unique” de correction, mais comme **source de nourriture pour la calibration**.

> Effet attendu : tu ne mesures plus seulement la “fréquence des rejets”, mais la **justesse réelle** de La Citadelle, ce qui est indispensable pour une vraie confiance de production.

---

## Tâche 6 — Calibration de la confiance (SMAC‑confiance)

- Mettre en place une **calibration de la confiance** entre le score SMAC affiché et la justesse observée (via vérité terrain et traces de rejet) :

  - Segmenter les réponses par score SMAC (ex: 0.0–0.74, 0.75–0.84, 0.85–0.94, 0.95–1.0).  
  - Pour chaque segment, calculer :  
    - % de réponses correctes,  
    - % de blocages / fallbacks,  
    - % de over‑correction.

- Utiliser des métriques élémentaires de calibration :
  - une forme simplifiée d’**ECE** (Expected Calibration Error),  
  - ou une **courbe de calibration** confiance / bonnes réponses.

- Si le segment 0.90–0.95 se retrouve avec un taux significatif de réponses qui doivent être corrigées, ajuster :
  - les seuils SMAC,  
  - la logique de décision du Critic,  
  - la pondération des agents.

> Effet attendu : éviter qu’un “score 0.95” soit perçu comme une garantie, alors que le système reste encore fragilisé par certains cas.

---

## Tâche 7 — Détection de dérive (Drift Alerts)

- Ajouter un module de **détection de dérive comportementale** qui surveille les écarts par rapport à une baseline saine (ex : la première semaine après déploiement de Vague 1) :

  - Alerte automatisée si :  
    - hausse soudaine de `Taux_Rejet_Critic`,  
    - explosion de `Taux_Echec_Syntax` sur un type de projet,  
    - augmentation de `Taux_Hypothese_Prudente` > 20 %,  
    - montée des motifs `blueprint_build_confusion` ou `ghost_tool`,  
    - dégradation de la corrélation `SMAC` / `correct` en vérité terrain.

- Configurer des canaux de notification (email, Slack, ou ticket automatique dans le Vault) pour les alertes critiques.

- Garder un historique des alertes et des justifications de désactivation, afin de contrôler le “noise” ajouté.

> Effet attendu : repérage proactif des dérives, plutôt que découverte tardive après plusieurs jours de dégradation.

---

## Tâche 8 — Boucle d’amélioration hebdomadaire

- Institutionnaliser une **revue hebdomadaire de calibration** orchestrée par La Citadelle (humain‑assistée) :

  Chaque semaine, générer un rapport automatique contenant :
  - top 5 types d’erreurs de la période,  
  - top 5 cas de `overblocked` ou faux positifs du Critic,  
  - évolutions des KPIs,  
  - performance de la calibration SMAC,  
  - recommandations de mise à jour de `reliability_tests`.

- À partir de ce rapport, engager un cycle de 3 décisions :
  1. Ajuster les règles de rejet du Critic ou du Syntax Proxy ;  
  2. Affiner la taxonomie d’échecs si des motifs nouveaux dominants apparaissent ;  
  3. Rajuster les seuils SMAC ou la pondération des agents si la calibration reste mauvaise.

- Documenter ces décisions dans `docs/governance/` avec un ADR implicite de type `ADR‑004‑Calibration`.

> Effet attendu : La Citadelle ne devient pas seulement plus fiable, elle devient **apprenante** sur ses propres limites.

---

Artéfacts finaux associés :
- `docs/governance/observability-v3.5.md` (ce plan)  
- `server/data/logs/reliability/` (stockage des traces complètes)  
- `turnTelemetry.js` (extension avec la taxonomie Vague 2)  
- `reliability_tests/` (nouveaux cas issus de vérité terrain et de dérive)
