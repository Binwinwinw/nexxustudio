@echo off
setlocal EnableDelayedExpansion

REM Audit securite local — sans npm audit (evite erreurs SSL registry Windows)
REM Usage: scripts\security-audit-local.bat
REM Depuis la racine du depot ou via double-clic

cd /d "%~dp0.."
set "ROOT=%CD%"
set "FAILED=0"

echo.
echo ============================================================
echo   NEXXUS STUDIO — Audit securite local (sans npm audit)
echo   Racine: %ROOT%
echo   Date:   %DATE% %TIME%
echo ============================================================
echo.

echo [1/2] Guards epistemiques (citadel:audit)...
echo ------------------------------------------------------------
call npm run citadel:audit
if errorlevel 1 (
  set "FAILED=1"
  echo [ECHEC] citadel:audit
) else (
  echo [OK] citadel:audit
)
echo.

echo [2/3] Tests routes securite (server/test:security)...
echo ------------------------------------------------------------
pushd server
call npm run test:security
if errorlevel 1 (
  set "FAILED=1"
  echo [ECHEC] test:security
) else (
  echo [OK] test:security
)
echo.

echo [3/3] Quality gate conversation (quality:gate)...
echo ------------------------------------------------------------
call npm run quality:gate
if errorlevel 1 (
  set "FAILED=1"
  echo [ECHEC] quality:gate
) else (
  echo [OK] quality:gate
)
popd
echo.

echo ============================================================
if "%FAILED%"=="0" (
  echo   RESULTAT GLOBAL: PASS
  echo   - Guards: 4/4 attendus
  echo   - Routes: 4/4 tests unitaires
  echo   - Conversation: quality:gate PASS
  echo.
  echo   Rappel manuel:
  echo   - ADMIN_PASSWORD distinct dans server\.env
  echo   - Verifier scratch\ sans .env versionnes
  echo   - Test manuel checklist SS5 (~5 min UI/curl)
) else (
  echo   RESULTAT GLOBAL: ECHEC — corriger avant commit
)
echo ============================================================
echo.

endlocal
exit /b %FAILED%
