# Planifie le rapport ops quotidien fusionne (08:00 locale)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/install-ops-daily-report-task.ps1

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BatPath = Join-Path $Root "scripts\ops-daily-report.bat"
$TaskName = "NexxusOpsDailyReport"

if (-not (Test-Path $BatPath)) {
    Write-Error "Script introuvable: $BatPath"
    exit 1
}

$Action = New-ScheduledTaskAction -Execute $BatPath -WorkingDirectory $Root
$Trigger = New-ScheduledTaskTrigger -Daily -At "08:00"
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Rapport ops quotidien La Citadelle (conversation + memoire gouvernee)" `
    -Force | Out-Null

Write-Host "Tache planifiee: $TaskName"
Write-Host "Execution: $BatPath"
Write-Host "Horaire: tous les jours a 08:00"
Write-Host "Manuel: npm run ops:daily-report (depuis server/)"
