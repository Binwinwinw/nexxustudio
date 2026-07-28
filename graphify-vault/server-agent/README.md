# Vault Graphify — export Obsidian (auto-généré)

Ce dossier est réservé à l’**export Obsidian** Graphify (`graphify-vault/server-agent/`), séparé de `citadelle-vault/`.

## État

Sur la CLI Graphify installée localement (2026-07-28) :

- `graphify update src/agent --force` → OK, sortie dans `server/src/agent/graphify-out/`
- `--obsidian` / `--obsidian-dir` sur `update` → **non reconnu** (`unknown update option`)
- Le post-build affiche parfois *Tip: run with --obsidian* — écart doc/CLI à surveiller à la montée de version

## En attendant l’export

- Ouvrir `server/src/agent/graphify-out/graph.html` ou `GRAPH_REPORT.md`
- Index humain : `citadelle-vault/Citadelle/01-Architecture/Agent-Memory-Map.md`
- Regénération : `pwsh -File server/scripts/refresh-graphify-agent.ps1`

Import quarantaine dans Citadelle (sans fusion racine) :

```powershell
pwsh -File server/scripts/merge-graphify-vault.ps1 -DryRun
pwsh -File server/scripts/merge-graphify-vault.ps1
```

Sans export Obsidian : `-BootstrapFromAgentOut` copie `GRAPH_REPORT.md` + `graph.html` vers `citadelle-vault/Citadelle/04-Graphify-Auto/`.

## Quand l’export sera disponible

```powershell
pwsh -File server/scripts/refresh-graphify-agent.ps1 -TryObsidian
```

Puis Obsidian → *Open folder as vault* sur ce dossier.
