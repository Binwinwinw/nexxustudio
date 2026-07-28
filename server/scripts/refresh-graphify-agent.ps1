# Regénère le graphe agent (server/src/agent) et synchronise server/graphify-out pour tool.graphify.
# Usage (depuis la racine repo) :
#   pwsh -File server/scripts/refresh-graphify-agent.ps1
#   pwsh -File server/scripts/refresh-graphify-agent.ps1 -TryObsidian

param(
    [switch]$TryObsidian
)

$ErrorActionPreference = "Stop"
$ServerRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ServerRoot
$AgentScan = Join-Path $ServerRoot "src\agent"
$AgentOut = Join-Path $AgentScan "graphify-out"
$RuntimeOut = Join-Path $ServerRoot "graphify-out"
$ObsidianVault = Join-Path $RepoRoot "graphify-vault\server-agent"

Set-Location $ServerRoot

Write-Host "==> graphify update src/agent --force"
graphify update src/agent --force
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

New-Item -ItemType Directory -Force -Path $RuntimeOut | Out-Null
Copy-Item -Force (Join-Path $AgentOut "graph.json") (Join-Path $RuntimeOut "graph.json")
if (Test-Path (Join-Path $AgentOut "GRAPH_REPORT.md")) {
    Copy-Item -Force (Join-Path $AgentOut "GRAPH_REPORT.md") (Join-Path $RuntimeOut "GRAPH_REPORT.md")
}
Write-Host "==> Copie vers $RuntimeOut (GRAPHIFY_GRAPH_PATH par défaut)"

if ($TryObsidian) {
    New-Item -ItemType Directory -Force -Path $ObsidianVault | Out-Null
    $obsidianArgs = @(
        "update", "src/agent", "--force",
        "--obsidian", "--obsidian-dir", $ObsidianVault
    )
    Write-Host "==> Tentative export Obsidian: graphify $($obsidianArgs -join ' ')"
    & graphify @obsidianArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Warning @"
Export Obsidian non supporté par cette version CLI (option --obsidian absente sur 'update').
Le message post-build peut mentionner --obsidian sans l'exposer encore — upgrade graphify ou suivre le ticket upstream.
Vault cible prévu: $ObsidianVault
Utilise GRAPH_REPORT.md + graph.html dans src/agent/graphify-out en attendant.
"@
    }
}

Write-Host "==> Smoke CLI (explain ocrVisionFallback)"
graphify explain ocrVisionFallback --graph (Join-Path $AgentOut "graph.json")

Write-Host "OK. Env optionnel: GRAPHIFY_GRAPH_PATH=$RuntimeOut\graph.json"
