# ADR-016 : Triangle de Gouvernance Humain — IA — Citadelle

**Statut** : Approuvé  
**Date** : 28/05/2026  
**Auteur** : Opérateur La Citadelle + Assistant IA (Cursor)

## Contexte

La Citadelle évolue d’un assistant « impressionnant » vers un assistant **souverain, mesurable et défendable**. Deux dérives doivent être évitées :

1. **Confiance aveugle** : une réponse fluide mais fausse, produite trop vite.
2. **Mécanisation aveugle** : un système qui exécute sans garder le contexte humain ni le jugement produit.

Le projet dispose déjà de briques techniques (contrat SIMPLE_FAST, parseur thinking, santé conversationnelle, `quality:gate`, rapport quotidien). Il manquait une **doctrine de gouvernance** claire sur qui fait quoi.

## Décision

Nous formalisons un **triangle de responsabilité** entre trois rôles :

| Rôle | Responsabilité | Livrables typiques |
|------|----------------|-------------------|
| **Humain (boussole)** | Intention, arbitrage, détection des dérives en usage réel | Priorités, validation terrain, refus des comportements « propres mais faux » |
| **Assistant IA (moteur)** | Analyse, recherche, diagnostic, proposition, tests | Patches, ADR, scripts, gates, rapports |
| **La Citadelle (système)** | Comportement observable, stable, mesurable, gouverné | Réponses conformes, logs, score santé, auto-blocage |

### Principe fondateur

> *La Citadelle doit produire des réponses correctes, répétables et gouvernées ; l’humain garde la boussole, le système garde la preuve.*

### Boucle opérationnelle (règle d’or)

1. L’**humain** identifie ce qui est bon ou mauvais en usage réel.
2. L’**assistant IA** transforme le constat en patch, test ou mécanisme.
3. **La Citadelle** exécute de façon mesurable (modes, KPI, incidents).
4. L’**humain** valide le résultat terrain.
5. Le **système** bloque automatiquement les régressions (`quality:gate`, pre-commit).

### Exigences système associées

- **Contrat de réponse** par mode (`INSTANT`, `SIMPLE_FAST`, `DOCUMENT`, `CRITICAL`).
- **Séparation stricte** raisonnement interne / contenu visible.
- **Observabilité** : score 0–100, incidents, fallback rate, badge cockpit/sidebar.
- **Gates déterministes** : `citadel:audit` → `test:security` → `quality:gate`.
- **Rapport quotidien** : `npm run conversation:daily-report`.
- **Refus propre** quand le signal est insuffisant (fail-closed épistémique).

## Conséquences

### Positives

- Alignement durable entre intention produit et exécution technique.
- Réduction des réponses trompeuses via preuve + mesure + blocage auto.
- Rôle humain explicite : filtre indispensable, pas « optionnel ».
- Trajectoire claire vers un assistant local-first **gouverné**, pas seulement performant.

### Négatives

- Légère friction avant commit (chaîne d’audit élargie).
- Nécessité de maintenir les évals et seuils à jour.

## Implémentation de référence (28/05/2026)

| Mécanisme | Emplacement |
|-----------|-------------|
| Score santé | `server/src/agent/telemetry/conversationHealthScore.js` |
| Gate qualité | `server/scripts/quality-gate.js` |
| Santé API | `GET /api/conversation/health` |
| Rapport quotidien | `server/src/scripts/daily-conversation-health-report.js` |
| Chaîne locale | `npm run security:audit:local` |

## Liens

- [[02-Architecture/adr/ADR-011-DISCIPLINE-EPISTEMIQUE|ADR-011 : Discipline Épistémique]]
- [[02-Architecture/adr/ADR-005-Sovereign-Safety-Governance|ADR-005 : Gouvernance Sécurité Souveraine]]
- [[04-Operations/reports/Rapport-Sante-Conversationnelle-2026-05-28|Rapport Santé Conversationnelle (exemple)]]
- [[Wiki/Wiki-ADRs-Index|Retour à l'Atlas des ADRs]]
