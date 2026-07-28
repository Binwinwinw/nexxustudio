# ADR de consolidation — Job Queue & Resumable Streaming

*Date : 25/05/2026*

## Contexte
La Citadelle a migré d’un modèle de production synchrone fondé sur une requête HTTP longue vers une architecture asynchrone orientée job. Le problème initial provenait du couplage fort entre la durée d’inférence du `SovereignOrchestrator` et la durée de vie de la socket réseau, ce qui exposait la génération lourde aux coupures de flux, aux timeouts et aux erreurs de type `ERR_ABORTED`.

L’introduction d’un `ProductionJobManager`, d’un flux de progression rejouable et d’un mécanisme de reprise par index a permis de découpler la production métier du transport réseau. Cette évolution s’inscrit dans une logique de résilience des tâches longues et rejoint les bonnes pratiques des architectures backend avec jobs, workers et diffusion d’état incrémentale.

## Acquis
- L’architecture dispose désormais d’un cycle de production plus robuste : le frontend initie un job, récupère un `jobId`, puis consomme un flux d’événements sans dépendre d’une requête POST monolithique de plusieurs minutes.
- Le mécanisme de reprise par `Last-Event-ID` et index d’événement permet un replay déterministe des messages non reçus, ce qui réduit fortement le risque de perte de contenu lors d’une micro-coupure réseau ou d’une reconnexion du client.
- L’arrêt d’urgence a aussi été fiabilisé par un endpoint dédié branché sur une logique d’abort explicite côté serveur, ce qui améliore le contrôle des traitements longs et la purge des charges encore actives.

## Risques résiduels
- **Persistance en mémoire :** Le principal risque restant concerne la persistance : tant que le buffer de job reste uniquement en mémoire, un redémarrage complet du processus Node efface l’historique d’événements et empêche la reprise au-delà d’une simple rupture réseau transitoire.
- **Volumétrie mémoire :** Un second risque tient à la volumétrie mémoire. Les jobs longs peuvent accumuler un grand nombre d’événements, ce qui impose à moyen terme une politique plus explicite de rétention, de compactage ou d’éviction que le seul garbage collection temporel (GC à 15 minutes).
- **Pertinence des tests E2E :** Enfin, la couche de test doit rester alignée sur la réalité d’exécution : une CI doit valider le contrat d’architecture avec une charge raisonnable (ex: 3 slides), tandis que les scénarios extrêmes (20 slides) doivent rester dans un circuit de validation plus long ou manuel.

## Prochaines décisions
1. **Support persistant :** La prochaine décision structurante doit porter sur la persistance du buffer d’événements, idéalement via un support léger comme SQLite ou un journal local sur disque, afin de garantir la reprise même après redémarrage du serveur.
2. **Cycle de vie des buffers :** Une seconde décision doit formaliser la politique de cycle de vie des jobs : taille maximale du buffer, durée de conservation, comportement au-delà d’un seuil mémoire, et éventuel compactage des tokens en segments plus gros.
3. **Double pyramide de tests :** Une troisième décision doit distinguer clairement deux types de validation automatisée : un test E2E CI court pour vérifier le contrat Generator-First, et un test de stress plus long destiné à qualifier les performances réelles sur des artefacts très lourds.

## Décision provisoire
L’architecture **Job Queue + Resumable Streaming** est adoptée comme socle V5 pour les productions lourdes. Elle est jugée suffisante pour sécuriser le transport et la continuité de génération à court terme, sous réserve d’une future itération dédiée à la persistance des buffers et à la gouvernance mémoire.
