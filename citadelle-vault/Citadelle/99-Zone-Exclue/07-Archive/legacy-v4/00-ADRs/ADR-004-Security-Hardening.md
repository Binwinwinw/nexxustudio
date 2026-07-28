# ADR-004 : Security Hardening & Zero-Trust Architecture

**Date** : 2026-05-03  
**Statut** : ✅ Validé  
**Expert** : Nexxus (Maître Orchestrateur)

## Contexte
L'introduction de capacités multimodales et d'un Knowledge Hub vectoriel a ouvert de nouveaux vecteurs d'attaque potentiels (injection documentaire, exfiltration d'embeddings, accès non autorisé aux métadonnées). La Citadelle doit garantir une souveraineté non seulement fonctionnelle mais aussi sécuritaire.

## Décision
Mise en place d'un durcissement multi-couches (Defense in Depth) :

1. **Isolation Réseau de la Mémoire** : Le conteneur ChromaDB est désormais restreint à l'interface loopback (`127.0.0.1:8008`). Aucun accès externe direct n'est possible ; seul le backend Nexxus peut interroger la base.
2. **Gating des Endpoints d'Indexation** : La route `/api/knowledge/index` est protégée par le middleware `requireInternalToken`. L'injection de connaissances nécessite un secret partagé fort (`INTERNAL_API_TOKEN`).
3. **Verrouillage de Session pour la Vision** : L'analyse d'image via `/api/vision/analyze` est désormais soumise à `requireSessionAccess`. Chaque upload doit être associé à un `sessionId` valide dont l'utilisateur possède l'accès (vérifié par `browser_id`).
4. **Harcèlement CORS** : Suppression de toute politique permissive. Les origines autorisées sont explicitement définies via `CORS_ORIGINS`.
5. **Protection contre l'Injection** : Les payloads JSON sont limités à 2 Mo et les fichiers vision à 10 Mo pour prévenir les attaques par déni de service (DoS).

## Conséquences
- **Confidentialité** : Les connaissances indexées (ADR, schémas, captures) sont protégées contre les accès non autorisés.
- **Intégrité** : La mémoire souveraine ne peut être altérée que par des processus authentifiés.
- **Résilience** : La surface d'attaque est réduite au strict nécessaire pour le fonctionnement de l'UI.
- **Auditabilité** : Chaque action d'indexation ou d'analyse est tracée au sein d'une session identifiée via le [[01-Strategy/scorecards/ecommerce-sovereign-v1.scorecard.json|Scorecard de Gouvernance]].

---
### 🛡️ Couches de Sécurité Complémentaires
- [[05-Knowledge/heritage/Composants-Souverains|🧱 Composants Souverains]] (Guards & Telemetry)
- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|🛡️ ADR-011 : Discipline Épistémique]] (Rigueur v4.5)
- [[04-Operations/reports/Audit-Integrite-v4.5|🏛️ Dernier Rapport d'Audit d'Intégrité]]

---
### 🔗 Liens de Parenté
- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[Bienvenue|⬅ Retour à l'Index Central]]

