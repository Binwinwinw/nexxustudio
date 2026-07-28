# Installe un hook git pre-commit : audit securite + retroaction Memoire des Erreurs
# Usage: powershell -ExecutionPolicy Bypass -File scripts/install-security-pre-commit.ps1

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$HooksDir = Join-Path $Root ".git\hooks"
$HookPath = Join-Path $HooksDir "pre-commit"

if (-not (Test-Path (Join-Path $Root ".git"))) {
    Write-Error "Depot git introuvable a la racine: $Root"
    exit 1
}

$HookContent = @'
#!/bin/sh
# Nexxus — pre-commit security feedback loop
cd "$(git rev-parse --show-toplevel)" || exit 1
npm run security:feedback
'@

New-Item -ItemType Directory -Force -Path $HooksDir | Out-Null
Set-Content -Path $HookPath -Value $HookContent -Encoding UTF8
Write-Host "Hook installe: $HookPath"
Write-Host "Chaque commit declenchera: npm run security:feedback (citadel:audit + test:security + quality:gate)"
