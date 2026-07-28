<#
.SYNOPSIS
    Plan de purge depot La Citadelle - 3 vagues, dry-run par defaut.

.DESCRIPTION
    Vague 1 : junk / artefacts / logs / doublons (immediat, faible risque).
    Vague 2 : apres verifs ciblees (outputs, archive, fixes, tessdata, scratch serveur).
    Vague 3 : arbitrage humain uniquement (poids GGUF) - jamais de suppression auto.

    Sans -Execute : previsualisation seule (aucune suppression).
    Avec -Execute : suppression reelle des cibles de la vague (sauf vague 3).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File ./scripts/purge-repo-junk.ps1 -Wave 1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File ./scripts/purge-repo-junk.ps1 -Wave 1 -Execute

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File ./scripts/purge-repo-junk.ps1 -Wave all
#>

param(
    [ValidateSet("1", "2", "3", "all")]
    [string]$Wave = "1",

    # Sans ce switch = dry-run (aucune suppression).
    [switch]$Execute,

    # Affiche aussi les cibles absentes (MISS).
    [switch]$VerboseMiss,

    # Fenetre "artefact E2E recent" (heures). Defaut 72h.
    [int]$RecentHours = 72,

    # Autorise la suppression d'artefacts E2E modifies dans RecentHours.
    [switch]$ForceRecentArtifacts,

    # Inclut scripts/fixes/* (migrations) en vague 2. Defaut: exclus (onboarding).
    [switch]$IncludeMigrationFixes
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$DryRun = -not $Execute
$ModeLabel = if ($DryRun) { "DRY-RUN" } else { "EXECUTE" }

function Get-PathSizeBytes {
    param([string]$LiteralPath)
    if (-not (Test-Path -LiteralPath $LiteralPath)) { return $null }
    $item = Get-Item -LiteralPath $LiteralPath -Force
    if (-not $item.PSIsContainer) { return [int64]$item.Length }
    $sum = (Get-ChildItem -LiteralPath $LiteralPath -Recurse -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    if ($null -eq $sum) { return [int64]0 }
    return [int64]$sum
}

function Format-Bytes {
    param($Bytes)
    if ($null -eq $Bytes) { return "-" }
    $n = [double]$Bytes
    if ($n -ge 1GB) { return ("{0:N2} GB" -f ($n / 1GB)) }
    if ($n -ge 1MB) { return ("{0:N1} MB" -f ($n / 1MB)) }
    if ($n -ge 1KB) { return ("{0:N1} KB" -f ($n / 1KB)) }
    return ("{0} B" -f $n)
}

# kind: file | dir | dir-contents | glob-dir | dir-contents-keep | human-only
$Catalog = @{
    "1" = @(
        @{ Rel = "scratch"; Kind = "dir-contents"; Note = "workspaces forge gitignores (~Go)" }
        @{ Rel = "playwright-report"; Kind = "dir"; Note = "artefact E2E - verifier diagnostic clos"; Guard = "e2e-recent" }
        @{ Rel = "test-results"; Kind = "dir"; Note = "artefact E2E - verifier diagnostic clos"; Guard = "e2e-recent" }
        @{ Rel = "dist"; Kind = "dir"; Note = "build Vite regenerable" }
        @{ Rel = "cecicela.md"; Kind = "file"; Note = "fichier vide" }
        @{ Rel = "test_succes.md"; Kind = "file"; Note = "fichier vide" }
        @{ Rel = "scratch_agent.js"; Kind = "file"; Note = "one-shot debug" }
        @{ Rel = "defaultSystemMessages.ts"; Kind = "file"; Note = "copie Continue hors app" }
        @{ Rel = "routerAgent.js_tableau_recapitulatif.csv"; Kind = "file"; Note = "export ad-hoc" }
        @{ Rel = ".env.prod"; Kind = "file"; Note = "stub vide" }
        @{ Rel = "playwright.config.mjs"; Kind = "file"; Note = "doublon ; E2E utilise .js" }
        @{ Rel = "logs"; Kind = "dir"; Note = "stub logs racine (runtime = server/logs)" }
        @{ Rel = "server\test_output.log"; Kind = "file"; Note = "log manuel" }
        @{ Rel = "server\test_output_utf8.log"; Kind = "file"; Note = "log manuel" }
        @{ Rel = "server\orchestrateur.js"; Kind = "file"; Note = "wrapper orphelin" }
        @{ Rel = "server\scratch_test.js"; Kind = "file"; Note = "test manuel racine" }
        @{ Rel = "server\manual-adr-test.js"; Kind = "file"; Note = "test manuel racine" }
        @{ Rel = "server\test_documentAnalysisP0.js"; Kind = "file"; Note = "test manuel racine" }
        @{ Rel = "server\test_ground_truth.mjs"; Kind = "file"; Note = "test manuel racine" }
        @{ Rel = "server\server"; Kind = "dir"; Note = "arborescence accidentelle nested" }
        @{ Rel = "server"; Kind = "glob-dir"; Glob = "tmp-*"; Note = "dossiers tmp tests atomiques" }
        @{ Rel = "node_modules\.vite-temp"; Kind = "dir"; Note = "cache Vite temporaire" }
    )
    "2" = @(
        @{ Rel = "tools\async_forge\outputs"; Kind = "dir-contents"; Note = "VERIF: aucun job forge en cours" }
        @{ Rel = "docs\archive\session_owners.json"; Kind = "file"; Note = "VERIF: pas de backup/prod qui le remonte" }
        @{ Rel = "docs\archive\README-session_owners.md"; Kind = "file"; Note = "avec session_owners.json" }
        @{ Rel = "scripts\fixes\apply_v4_1.cjs"; Kind = "file"; Note = "ONBOARDING: migration v4.1 - exclu sauf -IncludeMigrationFixes"; Guard = "migration-onboarding" }
        @{ Rel = "scripts\fixes\apply_v4_1.py"; Kind = "file"; Note = "ONBOARDING: migration v4.1 - exclu sauf -IncludeMigrationFixes"; Guard = "migration-onboarding" }
        @{ Rel = "scripts\fixes\fix_env.js"; Kind = "file"; Note = "ONBOARDING: one-shot env - exclu sauf -IncludeMigrationFixes"; Guard = "migration-onboarding" }
        @{ Rel = "server\eng.traineddata"; Kind = "file"; Note = "VERIF: OCR offline sans CDN OK" }
        @{ Rel = "server\fra.traineddata"; Kind = "file"; Note = "VERIF: OCR offline sans CDN OK" }
        @{ Rel = "server\scratch"; Kind = "dir-contents-keep"; Keep = @("injection_trap.txt"); Note = "VERIF: garder trap stress C6" }
        @{ Rel = "CITADELLE-LAUNCHER.bat"; Kind = "file"; Note = "VERIF: plus utilise en double-clic ?" }
    )
    "3" = @(
        @{ Rel = "models"; Kind = "human-only"; Note = "ARBITRAGE: GGUF locaux (~12 Go) si Ollama n utilise plus Modelfile FROM ./" }
        @{ Rel = "docs\agents\AGENTS.legacy.md"; Kind = "human-only"; Note = "ARBITRAGE: archive volontaire - garder par defaut" }
    )
}

function Resolve-Targets {
    param($Entry)
    $full = Join-Path $Root $Entry.Rel
    $list = New-Object System.Collections.Generic.List[object]

    switch ($Entry.Kind) {
        "glob-dir" {
            if (-not (Test-Path -LiteralPath $full)) { return @() }
            Get-ChildItem -LiteralPath $full -Directory -Force -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like $Entry.Glob } |
                ForEach-Object {
                    $list.Add([pscustomobject]@{
                            Path     = $_.FullName
                            Kind     = "dir"
                            Note     = $Entry.Note
                            WaveKind = $Entry.Kind
                            Guard    = $Entry.Guard
                        })
                }
        }
        "dir-contents-keep" {
            if (-not (Test-Path -LiteralPath $full)) { return @() }
            $keep = @($Entry.Keep)
            Get-ChildItem -LiteralPath $full -Force -ErrorAction SilentlyContinue |
                Where-Object { $keep -notcontains $_.Name } |
                ForEach-Object {
                    $childKind = "file"
                    if ($_.PSIsContainer) { $childKind = "dir" }
                    $list.Add([pscustomobject]@{
                            Path     = $_.FullName
                            Kind     = $childKind
                            Note     = $Entry.Note
                            WaveKind = $Entry.Kind
                            Guard    = $Entry.Guard
                        })
                }
        }
        "human-only" {
            $list.Add([pscustomobject]@{
                    Path     = $full
                    Kind     = "human-only"
                    Note     = $Entry.Note
                    WaveKind = $Entry.Kind
                    Guard    = $Entry.Guard
                })
        }
        default {
            $list.Add([pscustomobject]@{
                    Path     = $full
                    Kind     = $Entry.Kind
                    Note     = $Entry.Note
                    WaveKind = $Entry.Kind
                    Guard    = $Entry.Guard
                })
        }
    }
    return $list
}

function Get-NewestWriteTime {
    param([string]$LiteralPath)
    if (-not (Test-Path -LiteralPath $LiteralPath)) { return $null }
    $item = Get-Item -LiteralPath $LiteralPath -Force
    if (-not $item.PSIsContainer) { return $item.LastWriteTime }
    $newest = $item.LastWriteTime
    $child = Get-ChildItem -LiteralPath $LiteralPath -Recurse -Force -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($null -ne $child -and $child.LastWriteTime -gt $newest) {
        return $child.LastWriteTime
    }
    return $newest
}

function Format-AgeLabel {
    param($WriteTime)
    if ($null -eq $WriteTime) { return "age=?" }
    $age = (Get-Date) - $WriteTime
    $stamp = $WriteTime.ToString("yyyy-MM-dd HH:mm")
    if ($age.TotalHours -lt 1) {
        return ("mtime={0} (~{1:N0} min)" -f $stamp, $age.TotalMinutes)
    }
    if ($age.TotalHours -lt 48) {
        return ("mtime={0} (~{1:N1} h)" -f $stamp, $age.TotalHours)
    }
    return ("mtime={0} (~{1:N1} j)" -f $stamp, $age.TotalDays)
}

function Invoke-PurgeTarget {
    param($Target, [bool]$DoExecute)

    $exists = Test-Path -LiteralPath $Target.Path
    $bytes = $null
    if ($exists) { $bytes = Get-PathSizeBytes $Target.Path }
    $sizeLabel = Format-Bytes $bytes
    $mtime = $null
    if ($exists) { $mtime = Get-NewestWriteTime $Target.Path }
    $ageLabel = Format-AgeLabel $mtime
    $guard = [string]$Target.Guard

    if ($Target.Kind -eq "human-only") {
        Write-Host ("[WAVE3-HOLD] {0,-10}  {1}" -f $sizeLabel, $Target.Path) -ForegroundColor Magenta
        Write-Host ("             -> {0}" -f $Target.Note) -ForegroundColor DarkMagenta
        return [pscustomobject]@{ Status = "HOLD"; Bytes = [int64]0 }
    }

    # Garde-fou onboarding: migrations exclues sauf opt-in explicite.
    if ($guard -eq "migration-onboarding" -and -not $IncludeMigrationFixes) {
        Write-Host ("[SKIP-ONBOARD] {0,-10}  {1}" -f $sizeLabel, $Target.Path) -ForegroundColor DarkYellow
        Write-Host ("             -> {0} | {1}" -f $Target.Note, $ageLabel) -ForegroundColor DarkYellow
        Write-Host "             -> Pour supprimer: -IncludeMigrationFixes (apres verif install from scratch)" -ForegroundColor DarkYellow
        return [pscustomobject]@{ Status = "SKIP"; Bytes = [int64]0 }
    }

    if (-not $exists) {
        if ($VerboseMiss) {
            Write-Host ("[MISS]                 {0}" -f $Target.Path) -ForegroundColor DarkGray
        }
        return [pscustomobject]@{ Status = "MISS"; Bytes = [int64]0 }
    }

    $isRecentE2E = $false
    if ($guard -eq "e2e-recent" -and $null -ne $mtime) {
        $ageHours = ((Get-Date) - $mtime).TotalHours
        if ($ageHours -lt $RecentHours) { $isRecentE2E = $true }
    }

    if (-not $DoExecute) {
        $action = "WOULD remove"
        if ($Target.Kind -eq "dir-contents") { $action = "WOULD empty contents of" }
        $tag = $ModeLabel
        $color = "Cyan"
        if ($isRecentE2E) {
            $tag = "DRY-RUN/RECENT"
            $color = "Yellow"
        }
        Write-Host ("[{0}] {1,-10}  {2} {3}" -f $tag, $sizeLabel, $action, $Target.Path) -ForegroundColor $color
        Write-Host ("             -> {0} | {1}" -f $Target.Note, $ageLabel) -ForegroundColor DarkCyan
        if ($isRecentE2E) {
            Write-Host ("             -> GARDE: artefact < {0}h - Execute bloquera sauf -ForceRecentArtifacts" -f $RecentHours) -ForegroundColor Yellow
        }
        $previewBytes = [int64]0
        if ($null -ne $bytes) { $previewBytes = $bytes }
        return [pscustomobject]@{ Status = "PREVIEW"; Bytes = $previewBytes }
    }

    if ($isRecentE2E -and -not $ForceRecentArtifacts) {
        Write-Host ("[SKIP-RECENT] {0,-10}  {1}" -f $sizeLabel, $Target.Path) -ForegroundColor Yellow
        Write-Host ("             -> {0} | diagnostic E2E peut etre ouvert" -f $ageLabel) -ForegroundColor Yellow
        Write-Host "             -> Relance avec -ForceRecentArtifacts si diagnostics clos" -ForegroundColor Yellow
        return [pscustomobject]@{ Status = "SKIP"; Bytes = [int64]0 }
    }

    try {
        if ($Target.Kind -eq "dir-contents") {
            Get-ChildItem -LiteralPath $Target.Path -Force -ErrorAction SilentlyContinue |
                Remove-Item -Recurse -Force -ErrorAction Stop
        }
        elseif ($Target.Kind -eq "file") {
            Remove-Item -LiteralPath $Target.Path -Force -ErrorAction Stop
        }
        else {
            Remove-Item -LiteralPath $Target.Path -Recurse -Force -ErrorAction Stop
        }
        Write-Host ("[REMOVED] {0,-10}  {1}" -f $sizeLabel, $Target.Path) -ForegroundColor Yellow
        $removedBytes = [int64]0
        if ($null -ne $bytes) { $removedBytes = $bytes }
        return [pscustomobject]@{ Status = "REMOVED"; Bytes = $removedBytes }
    }
    catch {
        Write-Host ("[FAIL]    {0} - {1}" -f $Target.Path, $_.Exception.Message) -ForegroundColor Red
        return [pscustomobject]@{ Status = "FAIL"; Bytes = [int64]0 }
    }
}

$wavesToRun = @($Wave)
if ($Wave -eq "all") { $wavesToRun = @("1", "2", "3") }

Write-Host ""
Write-Host ("=== purge-repo-junk | mode={0} | wave(s)={1} ===" -f $ModeLabel, ($wavesToRun -join ",")) -ForegroundColor White
Write-Host ("Root: {0}" -f $Root)
if ($DryRun) {
    Write-Host "Aucune suppression. Relance avec -Execute apres revue." -ForegroundColor Green
}
else {
    Write-Host "ATTENTION: suppressions reelles activees." -ForegroundColor Red
}
Write-Host ""

$stats = @{
    Preview = 0
    Removed = 0
    Miss    = 0
    Hold    = 0
    Skip    = 0
    Fail    = 0
    Bytes   = [int64]0
}

foreach ($w in $wavesToRun) {
    Write-Host ("---- Vague {0} ----" -f $w) -ForegroundColor White
    if ($w -eq "3" -and $Execute) {
        Write-Host "Vague 3: aucune suppression automatique (arbitrage humain)." -ForegroundColor Magenta
    }

    foreach ($entry in $Catalog[$w]) {
        $targets = @(Resolve-Targets $entry)
        if ($targets.Count -eq 0) {
            if ($VerboseMiss) {
                Write-Host ("[MISS]                 {0}" -f (Join-Path $Root $entry.Rel)) -ForegroundColor DarkGray
                $stats.Miss++
            }
            continue
        }
        foreach ($t in $targets) {
            $doExec = $false
            if ($Execute -and ($w -ne "3")) { $doExec = $true }
            $result = Invoke-PurgeTarget -Target $t -DoExecute:$doExec
            switch ($result.Status) {
                "PREVIEW" { $stats.Preview++; $stats.Bytes += $result.Bytes }
                "REMOVED" { $stats.Removed++; $stats.Bytes += $result.Bytes }
                "MISS" { $stats.Miss++ }
                "HOLD" { $stats.Hold++ }
                "SKIP" { $stats.Skip++ }
                "FAIL" { $stats.Fail++ }
            }
        }
    }
    Write-Host ""
}

Write-Host "=== Bilan ===" -ForegroundColor White
Write-Host ("Preview/Removed size: {0}" -f (Format-Bytes $stats.Bytes))
Write-Host ("PREVIEW={0}  REMOVED={1}  SKIP={2}  MISS={3}  HOLD={4}  FAIL={5}" -f `
        $stats.Preview, $stats.Removed, $stats.Skip, $stats.Miss, $stats.Hold, $stats.Fail)
Write-Host ("Garde-fous: RecentHours={0} ForceRecentArtifacts={1} IncludeMigrationFixes={2}" -f `
        $RecentHours, [bool]$ForceRecentArtifacts, [bool]$IncludeMigrationFixes)

if ($DryRun -and $Wave -eq "1") {
    Write-Host ""
    Write-Host "Prochaine etape apres revue (pas de debug E2E ouvert) :" -ForegroundColor Green
    Write-Host "  npm run purge:wave1"
    Write-Host "Si artefacts E2E encore recents et diagnostics clos :"
    Write-Host "  powershell -ExecutionPolicy Bypass -File ./scripts/purge-repo-junk.ps1 -Wave 1 -Execute -ForceRecentArtifacts"
}

if ($stats.Fail -gt 0) { exit 1 }
exit 0
