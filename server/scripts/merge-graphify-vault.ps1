# Importe le vault Graphify (export Obsidian) dans le vault Citadelle — sous-dossier quarantaine uniquement.
# Pas de fusion au niveau racine du vault humain.
#
# Usage (racine repo) :
#   pwsh -File server/scripts/merge-graphify-vault.ps1 -DryRun
#   pwsh -File server/scripts/merge-graphify-vault.ps1
#   pwsh -File server/scripts/merge-graphify-vault.ps1 -BootstrapFromAgentOut
#
# -BootstrapFromAgentOut : si l'export Obsidian n'existe pas encore, copie GRAPH_REPORT.md + graph.html
#   depuis server/src/agent/graphify-out/ (navigation minimale).

param(
    [switch]$DryRun,
    [switch]$BootstrapFromAgentOut,
    [string]$SourceVault = "",
    [string]$TargetSubfolder = "04-Graphify-Auto"
)

$ErrorActionPreference = "Stop"
$ServerRoot = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ServerRoot
if (-not $SourceVault) {
    $SourceVault = Join-Path $RepoRoot "graphify-vault\server-agent"
}
$CitadelleVault = Join-Path $RepoRoot "citadelle-vault\Citadelle"
$TargetPath = Join-Path $CitadelleVault $TargetSubfolder
$BackupRoot = Join-Path $RepoRoot "backups\graphify-vault-merge"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogFile = Join-Path $BackupRoot "merge-log-$Timestamp.txt"

$ExcludeDirNames = @(".obsidian", "attachments", ".trash", ".git", "node_modules")

function Write-Log($Message) {
    $line = "[$(Get-Date -Format 'o')] $Message"
    Write-Host $line
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
        Add-Content -Path $LogFile -Value $line -Encoding UTF8
    }
}

function Test-HasMarkdownExport($Dir) {
    if (-not (Test-Path $Dir)) { return $false }
    $md = Get-ChildItem -Path $Dir -Filter "*.md" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
    return $null -ne $md
}

New-Item -ItemType Directory -Force -Path $TargetPath | Out-Null

if (-not (Test-HasMarkdownExport $SourceVault)) {
    Write-Log "Source vault vide ou sans .md : $SourceVault"
    if (-not $BootstrapFromAgentOut) {
        Write-Warning "Rien à importer. Lance refresh-graphify-agent.ps1 -TryObsidian après upgrade CLI, ou -BootstrapFromAgentOut."
        exit 1
    }
    $AgentOut = Join-Path $ServerRoot "src\agent\graphify-out"
    foreach ($name in @("GRAPH_REPORT.md", "graph.html")) {
        $src = Join-Path $AgentOut $name
        if (Test-Path $src) {
            $dest = Join-Path $TargetPath $name
            Write-Log "$(if ($DryRun) {'[dry-run] '})Copy bootstrap: $name"
            if (-not $DryRun) { Copy-Item -Force $src $dest }
        }
    }
    $readme = @"
# Graphify auto — bootstrap (export Obsidian pas encore disponible)

Contenu copié depuis ``server/src/agent/graphify-out/`` le $Timestamp.

- Ouvrir ``graph.html`` dans le navigateur pour explorer le graphe.
- Lire ``GRAPH_REPORT.md`` pour la synthèse.

Quand l'export Obsidian CLI sera actif, relancer ``merge-graphify-vault.ps1`` sans ``-BootstrapFromAgentOut``.
"@
    Write-Log "$(if ($DryRun) {'[dry-run] '})Write README bootstrap"
    if (-not $DryRun) {
        Set-Content -Path (Join-Path $TargetPath "README-bootstrap.md") -Value $readme -Encoding UTF8
    }
} else {
    if ((Test-Path $TargetPath) -and (Get-ChildItem $TargetPath -Force | Where-Object { $_.Name -ne ".gitkeep" })) {
        $BackupDest = Join-Path $BackupRoot "Citadelle-$TargetSubfolder-$Timestamp"
        Write-Log "$(if ($DryRun) {'[dry-run] '})Backup cible -> $BackupDest"
        if (-not $DryRun) {
            New-Item -ItemType Directory -Force -Path $BackupDest | Out-Null
            Copy-Item -Path $TargetPath -Destination $BackupDest -Recurse -Force
        }
    }

    $files = Get-ChildItem -Path $SourceVault -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object {
            $rel = $_.FullName.Substring($SourceVault.Length).TrimStart("\", "/")
            $parts = $rel -split "[\\/]"
            -not ($parts | Where-Object { $ExcludeDirNames -contains $_ })
        }

    foreach ($f in $files) {
        $rel = $f.FullName.Substring($SourceVault.Length).TrimStart("\", "/")
        $dest = Join-Path $TargetPath $rel
        Write-Log "$(if ($DryRun) {'[dry-run] '})Import $rel"
        if (-not $DryRun) {
            New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
            Copy-Item -Force $f.FullName $dest
        }
    }
}

$IndexNote = Join-Path $CitadelleVault "01-Architecture\Graphify-Auto-Index.md"
$indexBody = @"
# Graphify auto — index (quarantaine)

**Dossier** : ``$TargetSubfolder/``  
**Source** : ``graphify-vault/server-agent/`` (export Obsidian Graphify)  
**Dernière sync script** : $Timestamp  

## Règles

- Notes **auto-générées** — ne pas mélanger avec les ADR humains au même niveau.
- Regénération graphe : ``pwsh -File server/scripts/refresh-graphify-agent.ps1``
- Import vault : ``pwsh -File server/scripts/merge-graphify-vault.ps1``

## Liens

- Carte humaine : [[Agent-Memory-Map]]
- Index ADR : [[01-Architecture/02-Architecture/adr/Index-ADR]]
"@

Write-Log "$(if ($DryRun) {'[dry-run] '})Mise à jour Graphify-Auto-Index.md"
if (-not $DryRun) {
    Set-Content -Path $IndexNote -Value $indexBody -Encoding UTF8
}

Write-Log "Terminé. Cible: $TargetPath"
if (-not $DryRun -and (Test-Path $LogFile)) {
    Write-Host "Log: $LogFile"
}
