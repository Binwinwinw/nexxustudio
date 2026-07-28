@echo off
TITLE NEXXUS CITADEL - SOVEREIGN ENGINE
COLOR 0B

echo [0/4] Verification des dependances...
if not exist "node_modules\" (
    echo [!] Dependances racines manquantes. Installation...
    call npm install
)
if not exist "server\node_modules\" (
    echo [!] Dependances serveur manquantes. Installation...
    cd server && call npm install && cd ..
)

echo [1/4] Verification d'Ollama...
tasklist /FI "IMAGENAME eq ollama app.exe" 2>NUL | find /I /N "ollama app.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo [!] Ollama n'est pas lance. Demarrage d'Ollama...
    start "" "C:\Users\Binwinwin\AppData\Local\Programs\Ollama\ollama app.exe"
    timeout /t 5
)

echo [2/4] Demarrage du Cerveau (Server)...
start "Nexxus Server" cmd /k "npm run server"

echo [3/4] Demarrage de l'Interface (Vite)...
start "Nexxus UI" cmd /k "npm run dev"

echo [4/4] Optimisation AirLLM...
start "Nexxus AirLLM" cmd /k "npm run airllm"

echo.
echo ===================================================
echo    LA CITADELLE EST EN COURS DE DEPLOIEMENT...
echo ===================================================
timeout /t 5
exit
