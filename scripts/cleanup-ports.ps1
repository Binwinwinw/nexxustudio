<#
.SYNOPSIS
    Script de nettoyage intelligent des ports pour Nexxus Citadel.
.DESCRIPTION
    Identifie les processus ecoutant sur une liste de ports et les arrete, 
    sauf s'ils font partie d'une whitelist de processus proteges (ex: Ollama).
    Supporte un mode DryRun pour previsualiser les actions.
#>

param(
    [switch]$DryRun,
    [switch]$ForceKillAll
)

# --- Configuration ---
$TargetPorts = @(3000, 5173, 5174, 8008, 11434, 11435, 11436, 11437)

# Whitelist : [Port] = @(Noms de processus autorises)
$Whitelist = @{
    11434 = @('ollama', 'ollama app', 'ollama_llama_server')
}

# Docker Desktop expose les ports via com.docker.backend / wslrelay — ne jamais les tuer.
$DockerProcessNames = @(
    'com.docker.backend',
    'com.docker.service',
    'com.docker.build',
    'wslrelay',
    'docker-sandbox',
    'vpnkit'
)

# --- Statistiques ---
$Stats = @{
    Stopped   = 0
    Preserved = 0
    Failed    = 0
}

function Write-CitadelLog {
    param([string]$Message, [ConsoleColor]$Color = "White")
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Message" -ForegroundColor $Color
}

function Clear-Port {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) { return }

    $uniquePids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($tPid in $uniquePids) {
        if ($tPid -eq 0 -or $tPid -eq $PID) { continue }

        try {
            $process = Get-Process -Id $tPid -ErrorAction Stop
            $pName = $process.ProcessName.ToLower()
            $isPortWhitelisted = $Whitelist.ContainsKey($Port) -and $Whitelist[$Port] -contains $pName
            $isDockerProxy = $DockerProcessNames -contains $pName
            $isProtected = $isPortWhitelisted -or $isDockerProxy

            if ($isProtected -and -not $ForceKillAll) {
                Write-CitadelLog -Message "[Port $Port] PROTEGE : $pName (PID $tPid) conserve." -Color Gray
                $Stats.Preserved++
                continue
            }

            if ($DryRun) {
                Write-CitadelLog -Message "[Port $Port] [DRY-RUN] Serait arrete : $pName (PID $tPid)" -Color Cyan
                $Stats.Stopped++
            }
            else {
                Write-CitadelLog -Message "[Port $Port] ARRET : $pName (PID $tPid)..." -Color Yellow
                Stop-Process -Id $tPid -Force -ErrorAction Stop
                Write-CitadelLog -Message "[Port $Port] Succes." -Color Green
                $Stats.Stopped++
            }
        }
        catch {
            Write-CitadelLog -Message "[Port $Port] ERREUR PID $tPid : $($_.Exception.Message)" -Color Red
            $Stats.Failed++
        }
    }
}

# --- Execution ---
$Header = "--- Nettoyage $(if($DryRun){'DRY-RUN'}else{'ACTIF'}) des ports Citadelle ---"
Write-CitadelLog -Message $Header -Color Cyan

foreach ($port in $TargetPorts) {
    Clear-Port -Port $port
}

# --- Resume ---
Write-CitadelLog -Message "--- Resume du Nettoyage ---" -Color Cyan
Write-CitadelLog -Message "Processus arretes   : $($Stats.Stopped)" -Color Yellow
Write-CitadelLog -Message "Processus preserves : $($Stats.Preserved)" -Color Gray
if ($Stats.Failed -gt 0) {
    Write-CitadelLog -Message "Echecs de nettoyage : $($Stats.Failed)" -Color Red
}

Write-CitadelLog -Message "Zone securisee. Pret pour le demarrage." -Color Green
exit 0
