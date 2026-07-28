Write-Host "=== PROCESSUS NODE.JS ACTIFS ===" -ForegroundColor Cyan
Get-Process -Name "node" -ErrorAction SilentlyContinue | Format-Table -AutoSize Id, CPU, @{N='RAM(MB)';E={[math]::Round($_.WorkingSet/1MB,1)}}, StartTime

Write-Host ""
Write-Host "=== LIGNES DE COMMANDE NODE ===" -ForegroundColor Cyan
Get-WmiObject Win32_Process | Where-Object { $_.Name -like "node.exe" } | ForEach-Object {
    Write-Host "PID $($_.ProcessId) (Parent: $($_.ParentProcessId))" -ForegroundColor Yellow
    Write-Host "  CMD: $($_.CommandLine)" -ForegroundColor White
    Write-Host ""
}

Write-Host "=== PROCESSUS NODEMON ACTIFS ===" -ForegroundColor Cyan
Get-Process -Name "nodemon" -ErrorAction SilentlyContinue | Format-Table -AutoSize Id, CPU, @{N='RAM(MB)';E={[math]::Round($_.WorkingSet/1MB,1)}}
Write-Host "(Si vide : aucun nodemon actif)" -ForegroundColor Gray
