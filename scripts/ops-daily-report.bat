@echo off
REM Rapport ops quotidien fusionne (conversation + memoire)
cd /d "%~dp0.."
cd server
call npm run ops:daily-report
exit /b %ERRORLEVEL%
