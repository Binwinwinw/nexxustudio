# SELF_ARCHITECTURE_AUDIT_V1 — design

**Statut** : design (pas encore câblé runtime)  
**Date** : 2026-07-19  
**Périmètre** : introspection gouvernée read-only de Nexxus / La Citadelle

## Objectif

Permettre à Nexxus de **se décrire** à partir de preuves runtime (code, tools, contrats, policies), sans droit d’écriture sur ce qui le compose, et sans dériver en inventaire fourre-tout.

Séparé de :

- `SELF_RUNTIME_CAPABILITIES_V1` — fiche « ce que je peux / ne peux pas » (modalités, tools, gates)
- `FEATURE_OPPORTUNITY_REVIEW_V1` — suggestions bornées (3–7 max) à partir des audits

## Entrées

| Champ | Obligatoire | Notes |
| --- | --- | --- |
| `query` | oui | Intention utilisateur (audit, cartographie, « qu’est-ce qui te compose ») |
| `sessionId` | non | Télémétrie |
| `scope` | non | défaut `citadelle_core` |
| `focusPaths` | non | Sous-ensemble allowlist |

## Allowlist lecture (deny by default hors liste)

- `server/src/agent/` (policies, pipeline, contracts loaders)
- `server/config/`
- `server/data/skills/` (manifests, pas blobs arbitraires)
- `docs/agents/`, `docs/storage-architecture.md`
- `AGENTS.md`, `.agents/skills/*/SKILL.md` (métadonnées)

Hors scope : secrets (`.env`), `node_modules`, caches, sessions utilisateur, télémetrie brute.

## Sorties (rapport structuré)

```text
## Périmètre
## Capacités prouvées (liens registry / tools)
## Modules branchés vs orphelins (signaux)
## Limitations & ambiguïtés
## Opportunités (max 5, scorées — ou renvoi FEATURE_OPPORTUNITY_REVIEW_V1)
## Ce qui n’a pas été lu (hors allowlist)
```

Pas de dump de fichiers entiers dans le chat : chemins + rôle + preuve courte.

## Garde-fous

1. **Read-only** : aucun writer, aucun patch, aucun `fs.write*` dans ce contrat.
2. **Pas de self-improve loop** : critique ≠ action ; toute écriture passe par un autre contrat + gate humain.
3. **Pas de scan illimité** : plafond fichiers / octets / profondeur.
4. **Pas de secrets** : refus explicite si chemin sensible.
5. **Suggestions bornées** : rubric utilité × mission × dette × non-duplication ; classes `quick_win | strategic | reject`.

## Routage conversationnel

| Signal utilisateur | Path attendu |
| --- | --- |
| Image / vidéo / vision + capacité | `meta_capabilities_modalities_deterministic` (G47) |
| Inventaire capacités runtime | futur `SELF_RUNTIME_CAPABILITIES_V1` |
| Cartographie architecture | futur `SELF_ARCHITECTURE_AUDIT_V1` |
| « As-tu des infos sur ton propre fonctionnement » sans modalité | overview méta contrôlée, **pas** `familiarity_domain_overview` sur le sujet extrait |

## Non-objectifs

- Pseudo-conscience ou auto-modification
- Remplacer un audit IDE / GitNexus pour refactor
- Fourre-tout d’idées produit

## Étapes d’implémentation (ultérieures)

1. Capability Registry JSON (statut, source, portée, confiance).
2. Tool `self_architecture_audit_readonly` + allowlist.
3. Contrat + short-circuit / pipeline path dédié.
4. Batterie tests (refus write, plafond, hors allowlist).
