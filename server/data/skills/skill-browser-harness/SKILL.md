# Skill : Browser Harness (Phase C — spec)

## Mission

**Navigation web instrumentée gouvernée** pour La Citadelle — capacité transversale Nexxus Browser / Web Operator.

Phase C : **Observe local-only** — session Chromium isolée, `getComputedStyle`, snapshot DOM, traces corrélées.

## Statut

`enabled: false` — infrastructure en cours de spec / implémentation.

## Capacités (roadmap)

| Phase | Capacité |
|-------|----------|
| C | Observe + Trace (local-only) |
| D | Act (actions avec confirmation) |
| E | Intents chat WEB_* |
| F | Verify visuel (Impeccable) |

## Consommateurs

- `skill-design-extract` — mode `hybrid` / `rendered`
- Impeccable — audit post-Forge (futur)
- QA opérateur Nexxus Studio

## Gouvernance

- Egress `local-only` par défaut
- Lecture seule Phase C
- `trace_id` + `browser_session_id` obligatoires
- Fail-closed egress

## Non-objectifs Phase C

- Skill chat actif
- Crawl public non contrôlé
- Actions destructives sans confirmation

## Spec complète

[[Browser-Harness-Phase-C]]

## Liens

- [[skill-design-extract]]
- [[skill-impeccable]]
- [[skill-egress-security]]
