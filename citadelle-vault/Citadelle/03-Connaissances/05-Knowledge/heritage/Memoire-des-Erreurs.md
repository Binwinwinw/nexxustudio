# Mémoire des Erreurs Agentiques

Cette note consigne les erreurs passées commises par les agents (La Citadelle / Nexxus) afin de documenter les leçons tirées, d'enrichir le Golden Set et de servir de base de gouvernance opérationnelle.

## Modèle de Fiche d'Erreur
- **Incident** : [Date et résumé bref]
- **Symptôme** : [Ce qu'il s'est passé / erreur initiale]
- **Mauvaise Réponse** : [Ce que l'agent a dit de mal]
- **Contexte Manquant** : [Pourquoi c'était mal, ce qui n'a pas été vérifié]
- **Motif de Rejet** : [Nom exact du guard / catégorie de rejet]
- **Signal de Détection** : [Indice concret qui déclenche le guard]
- **Portée d'Application** : [Nexxus, experts, orchestrateur, pipeline, etc.]
- **Directive Gravée** : [Règle d'or ajoutée au système]
- **Test Ajouté** : [Nom/ID du test dans le Golden Set]

---

## Fiches d'Erreurs

### Incident : 22 Mai 2026 - Prescription prématurée sur erreur d'infrastructure

- **Symptôme** : Erreur de connexion base de données ou infrastructure remontée par l'utilisateur (ex: `PDOException: php_network_getaddresses: getaddrinfo for db failed: Hôte inconnu` ou `econnrefused`).
- **Mauvaise Réponse** : L'assistant a prescrit des corrections génériques (ex: passer à `localhost` ou modifier `ufw disable` sous Linux).
- **Contexte Manquant** : L'assistant n'a pas vérifié l'environnement d'exécution réel de l'utilisateur (ex: Docker vs local Windows), tombant dans une sur-généralisation prescriptive sans triage.
- **Motif de Rejet** : `premature_prescription` / `missing_environment_triage`
- **Signal de Détection** : Présence d'un symptôme d'infrastructure + solution immédiate non contextualisée (host, port, service, réseau, conteneur).
- **Portée d'Application** : Nexxus, experts techniques, orchestrateur.
- **Directive Gravée** : *"En présence d’une erreur d’infrastructure (BDD, réseau, service), Nexxus doit d’abord établir le contexte d’exécution réel avant de prescrire une correction. Aucune substitution d’host, de port ou de chemin ne doit être présentée comme universelle sans arborescence de contexte explicite."*
- **Test Ajouté** : `quality_03_premature_prescription` et `quality_04_missing_environment_triage` dans `quality-instrumentation.test.js`.

### Incident : 22 Mai 2026 - Prescription prématurée sur analyse de sécurité

- **Symptôme** : Demande ou alerte de sécurité soulevée par l'utilisateur (ex: attaque XSS, faille).
- **Mauvaise Réponse** : L'assistant prescrit un durcissement immédiat et générique (« Il faut immédiatement ajouter l’authentification, chiffrer toutes les données, activer un WAF, et durcir les permissions. ») sans analyser le risque.
- **Contexte Manquant** : Absence de qualification du contexte de menace : surface exposée, modèle de déploiement, données sensibles concernées, niveau de criticité, et preuve du vecteur de risque observé.
- **Motif de Rejet** : `premature_security_prescription` / `missing_security_triage`
- **Signal de Détection** : Mention de menace ou de faille + prescription défensive générique sans triage de périmètre.
- **Portée d'Application** : Nexxus, experts sécurité, orchestrateur.
- **Directive Gravée** : *"En matière de sécurité, Nexxus ne doit jamais prescrire de mesure défensive sans qualifier d’abord le contexte de menace, le périmètre exposé et la criticité des actifs concernés. Toute recommandation doit séparer clairement observation, hypothèse, impact et mesure proposée. En l’absence de triage de sécurité explicite, la réponse doit suspendre la prescription et demander les informations manquantes."*
- **Test Ajouté** : `quality_05_premature_security_prescription` et `quality_06_missing_security_triage` dans `quality-instrumentation.test.js`.

### Incident : 22 Mai 2026 - Prescription prématurée sur optimisation de performance

- **Symptôme** : L'utilisateur signale une lenteur ou un problème de performance de manière vague (ex: « ça rame », « le site est lent »).
- **Mauvaise Réponse** : L'assistant prescrit des optimisations directes (« Le problème vient sûrement du manque de cache, il faut optimiser les requêtes et utiliser un lazy loading plus agressif. ») sans avoir réclamé de métriques.
- **Contexte Manquant** : Absence totale de diagnostic de performance : métrique dégradée, ligne de base, contexte d'exécution, charge observée, endroit exact de la lenteur ou profilage.
- **Motif de Rejet** : `premature_performance_prescription` / `missing_performance_triage`
- **Signal de Détection** : Mot-clé de lenteur/charge + optimisation proposée sans métriques, sans base de comparaison, sans localisation du goulot.
- **Portée d'Application** : Nexxus, experts performance, orchestrateur.
- **Directive Gravée** : *"En matière de performance, Nexxus ne doit jamais prescrire d’optimisation sans métriques observées, ligne de base et localisation du goulot. Toute réponse doit d’abord qualifier le symptôme, le contexte d’exécution, et l’impact mesuré avant de proposer un changement. En l’absence de mesure explicite, la réponse doit suspendre la prescription et demander les données de performance manquantes."*
- **Test Ajouté** : `quality_07_premature_performance_prescription` et `quality_08_missing_performance_triage` dans `quality-instrumentation.test.js`.

### Incident : 22 Mai 2026 - Prescription prématurée sur correctif de code

- **Symptôme** : L'utilisateur signale un bug générique dans son code (ex: « le bouton ne marche pas », « ça plante avec une erreur »).
- **Mauvaise Réponse** : L'assistant propose immédiatement un remplacement de code ou une suggestion de patch (« Remplace cette fonction par une version plus propre, ça devrait corriger le problème. ») sans avoir vu le code complet ou la trace d'erreur.
- **Contexte Manquant** : Absence de localisation de la zone fautive, de reproduction du bug, d'analyse du mécanisme de défaillance ou de lecture de la trace d'erreur.
- **Motif de Rejet** : `premature_code_prescription` / `missing_code_triage`
- **Signal de Détection** : Signal de bug + proposition de patch immédiat sans fichier/module, sans reproduction, sans trace.
- **Portée d'Application** : Nexxus, experts code, orchestrateur.
- **Directive Gravée** : *"En matière de correctifs de code, Nexxus ne doit jamais proposer de modification sans identifier précisément la zone fautive, le symptôme reproductible et le mécanisme probable de défaillance. Toute réponse doit séparer l’analyse du bug, le périmètre du patch et le risque de régression. En l’absence de diagnostic localisé, la réponse doit suspendre le correctif et demander les extraits de code ou traces manquants."*
- **Test Ajouté** : `quality_09_premature_code_prescription` et `quality_10_missing_code_triage` dans `quality-instrumentation.test.js`.

### Incident : 22 Mai 2026 - Survol pédagogique et catalogue d'outils

- **Symptôme** : L'utilisateur demande à apprendre une technologie, par exemple Python ou la création d'un site web.
- **Mauvaise Réponse** : L'assistant liste un grand nombre de bibliothèques complexes et hétérogènes (ex: React, Django, Pandas, Numpy) ou propose une série d'étapes vagues sans exercice pratique ni objectif.
- **Contexte Manquant** : Absence de qualification du niveau cible, d'une progression logique du simple au complexe, et d'une séparation entre le socle du langage et l'écosystème. Il manque des exercices pratiques ou des résultats attendus.
- **Motif de Rejet** : `pedagogical_overbreadth` / `missing_learning_path`
- **Signal de Détection** : Sujet pédagogique + catalogue d'outils hétérogènes ou progression absente / exercices absents.
- **Portée d'Application** : Nexxus, experts pédagogiques, orchestrateur.
- **Directive Gravée** : *"Toute réponse de type tutoriel ou éducative doit préciser le niveau cible, structurer la progression du simple au complexe, distinguer le socle de langage de l'écosystème externe, et fournir des objectifs concrets ainsi qu'au moins un exercice par étape. Ne fournissez jamais un catalogue d'outils complexes à un débutant. En l'absence de parcours structuré, révisez la réponse."*
- **Test Ajouté** : `quality_11_pedagogical_overbreadth` et `quality_12_missing_learning_path` dans `quality-instrumentation.test.js`.

### Incident : 23 Mai 2026 - Perte de continuité et erreur de routage d'intention

- **Symptôme** : L'utilisateur effectue une demande nécessitant une réflexion experte, une revue technique, un audit de code ou une analyse d'architecture et de gouvernance.
- **Mauvaise Réponse** : L'assistant répond avec une phrase d'introduction générique (« Voici un résumé », « C'est une bonne idée », « La stratégie est importante ») et produit une sortie superficielle.
- **Contexte Manquant** : L'assistant n'a pas reconnu la profondeur de la tâche demandée et n'a pas basculé dans un mode expert. Il manque le cadrage formel, l'intention détaillée, le contexte stratégique ou l'explicitation des incertitudes.
- **Motif de Rejet** : `intent_misdirection` / `context_breakage`
- **Signal de Détection** : Demande analytique ou de gouvernance + réponse générique, faible densité d'analyse, absence d'ancrage fort.
- **Portée d'Application** : Nexxus, orchestrateur, experts techniques, gouvernance.
- **Directive Gravée** : *"Toute requête à vocation analytique, technique ou de gouvernance doit être routée selon son intention réelle et son contexte courant. Nexxus ne doit jamais produire une réponse générique lorsqu'une continuité contextuelle, une analyse experte ou un traitement spécialisé est attendu. En cas d'ambiguïté sur l'intention, explicitez le cadrage ou demandez la précision nécessaire avant de répondre."*
- **Test Ajouté** : `quality_13_intent_misdirection` et `quality_14_context_breakage` dans `quality-instrumentation.test.js`.

### Incident : 23 Mai 2026 - Dérive progressive (Progressive Drift) après cadrage expert

- **Symptôme** : L'utilisateur pose une question complexe ou demande un audit approfondi.
- **Mauvaise Réponse** : L'assistant entame la réponse avec un très bon cadrage (ex: "Je vais faire une analyse experte de l'architecture...") mais dérive vers une conclusion ou un format générique (ex: "En gros c'est une bonne idée et voici un résumé...").
- **Contexte Manquant** : L'assistant a bien classifié l'intention mais n'a pas su maintenir la discipline épistémique jusqu'au bout, chutant dans la complaisance conversationnelle.
- **Motif de Rejet** : `progressive_drift`
- **Signal de Détection** : Demande complexe + présence conjointe de termes experts (en début de réponse) et de phrases superficielles/génériques de remplissage.
- **Portée d'Application** : Nexxus, experts de profondeur, orchestrateur.
- **Directive Gravée** : *"Un cadrage expert initial n'autorise pas l'utilisation de résumés génériques ou de remplissage superficiel par la suite. La rigueur de l'intention doit être maintenue jusqu'au dernier token de la réponse."*
- **Test Ajouté** : `quality_15_progressive_drift` dans `quality-instrumentation.test.js`.

### Incident : 23 Mai 2026 - Prescription prématurée sur analyse architecturale

- **Symptôme** : L'utilisateur demande une analyse d'architecture et un correctif minimal concernant l'orchestration (ex: séparation SovereignOrchestrator et agentPipeline.js).
- **Mauvaise Réponse** : L'assistant prescrit des modifications génériques (audit, logging, pool d'experts) sans demander le code ou les logs de l'orchestrateur.
- **Contexte Manquant** : Absence d'examen du mécanisme de réveil, des logs ou de la zone fautive avant de proposer une refonte ou un correctif générique.
- **Motif de Rejet** : `premature_code_prescription` / `missing_code_triage`
- **Signal de Détection** : Mots-clés d'analyse d'architecture + proposition de stratégie/logging sans extraction de code ou de diagnostic.
- **Portée d'Application** : Nexxus, orchestrateur.
- **Directive Gravée** : *"Une demande d’analyse architecturale suivie d’un correctif minimal ne doit jamais déclencher une prescription de solution tant que la zone fautive, le mécanisme de réveil et les artefacts de diagnostic n’ont pas été explicitement obtenus."*
- **Test Ajouté** : (Couvert par `quality_09_premature_code_prescription` et `quality_10_missing_code_triage`).

---

## Tableau récapitulatif

| Incident | Motif de Rejet | Portée d'Application | Test Ajouté |
|---|---|---|---|
| 22 Mai 2026 - Prescription prématurée sur erreur d'infrastructure | `premature_prescription` / `missing_environment_triage` | Nexxus, experts techniques, orchestrateur | `quality_03_premature_prescription`, `quality_04_missing_environment_triage` |
| 22 Mai 2026 - Prescription prématurée sur analyse de sécurité | `premature_security_prescription` / `missing_security_triage` | Nexxus, experts sécurité, orchestrateur | `quality_05_premature_security_prescription`, `quality_06_missing_security_triage` |
| 22 Mai 2026 - Prescription prématurée sur optimisation de performance | `premature_performance_prescription` / `missing_performance_triage` | Nexxus, experts performance, orchestrateur | `quality_07_premature_performance_prescription`, `quality_08_missing_performance_triage` |
| 22 Mai 2026 - Prescription prématurée sur correctif de code | `premature_code_prescription` / `missing_code_triage` | Nexxus, experts code, orchestrateur | `quality_09_premature_code_prescription`, `quality_10_missing_code_triage` |
| 22 Mai 2026 - Survol pédagogique et catalogue d'outils | `pedagogical_overbreadth` / `missing_learning_path` | Nexxus, experts pédagogiques, orchestrateur | `quality_11_pedagogical_overbreadth`, `quality_12_missing_learning_path` |
| 23 Mai 2026 - Perte de continuité et erreur de routage d'intention | `intent_misdirection` / `context_breakage` | Nexxus, orchestrateur, experts techniques, gouvernance | `quality_13_intent_misdirection`, `quality_14_context_breakage` |
| 23 Mai 2026 - Prescription prématurée sur analyse architecturale | `premature_code_prescription` / `missing_code_triage` | Nexxus, orchestrateur | `quality_09`, `quality_10` |

---

## Principes de Gouvernance

1. Une erreur n'est utile que si elle est reliée à un motif de rejet explicite.
2. Un motif de rejet n'est utile que s'il dispose d'un signal de détection observable.
3. Un signal de détection n'est utile que s'il est relié à un test automatisé.
4. Un test automatisé n'est utile que s'il protège une directive gravée dans le système.
5. Une directive gravée n'est utile que si elle est reliée à une couche de gouvernance mesurable.

---

## Index des Motifs

- `security_regression`
- `failed_security_audit`
- `premature_prescription`
- `missing_environment_triage`
- `premature_security_prescription`
- `missing_security_triage`
- `premature_performance_prescription`
- `missing_performance_triage`
- `premature_code_prescription`
- `missing_code_triage`
- `pedagogical_overbreadth`
- `missing_learning_path`
- `intent_misdirection`
- `context_breakage`
