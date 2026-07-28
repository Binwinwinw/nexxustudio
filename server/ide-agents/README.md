# IDE agents (hors runtime Nexxus)

Déplacés depuis `server/data/agents/` le **2026-07-19**.

Ces fichiers `*.agent.md` (planner, implementer, reviewer, release-manager) sont des définitions d’agents **outil IDE** (frontmatter Copilot/Cursor-like). Ils ne sont **pas** chargés par `skillLoader` / `skillRuntimeRegistry` (ceux-ci lisent `server/data/skills/`).

Placer ici évite de mélanger tooling IDE et données runtime de La Citadelle.
