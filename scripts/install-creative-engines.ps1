# scripts/install-creative-engines.ps1
Write-Host "🎨 [Citadelle] Initialisation de l'installateur créatif (Vague 5)..." -ForegroundColor Cyan

$VRAM_PROFILE = "LIGHT" # Par défaut, on joue la sécurité
if ($args[0] -eq "STANDARD") { $VRAM_PROFILE = "STANDARD" }

Write-Host "🚀 Profil sélectionné : $VRAM_PROFILE" -ForegroundColor Yellow

# --- GESTION DE L'ENVIRONNEMENT VIRTUEL (V5 ISOLATION) ---
$VENV_PATH = "server/creative/venv"
if (!(Test-Path $VENV_PATH)) {
    Write-Host "📂 Création d'un environnement Python 3.11 isolé dans $VENV_PATH..." -ForegroundColor Yellow
    # On tente d'utiliser le launcher py -3.11 (standard Windows)
    & py -3.11 -m venv $VENV_PATH
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ ÉCHEC : Python 3.11 n'est pas installé." -ForegroundColor Red
        Write-Host "💡 Pour l'installer rapidement, lancez :" -ForegroundColor Yellow
        Write-Host "   winget install Python.Python.3.11" -ForegroundColor Cyan
        exit
    }
}

$PYTHON_EXE = "$VENV_PATH/Scripts/python.exe"
$PIP_EXE = "$VENV_PATH/Scripts/pip.exe"

Write-Host "🐍 Utilisation de : $(&$PYTHON_EXE --version)" -ForegroundColor Green

# 1. Mise à jour de l'environnement isolé
Write-Host "📦 Installation de Torch CUDA 12.1 dans le Venv..."
&$PIP_EXE install --upgrade pip
&$PIP_EXE install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

Write-Host "📦 Installation des librairies de génération (diffusers, transformers, scipy)..."
# On force des versions compatibles avec mergekit si possible, ou on ignore le conflit si isolé
&$PIP_EXE install diffusers transformers==4.40.2 accelerate safetensors==0.5.3 scipy invisible-watermark mediapipe omegaconf fastapi uvicorn pydantic python-dotenv

# 2. Le moteur audio passe par Transformers (plus besoin de build AudioCraft)
Write-Host "🎵 Configuration du moteur audio via Transformers (Wave 5 Optimized)..."
# Dépendances déjà incluses dans transformers + scipy

# 3. Préparation du Cache Modèle (Priorité IMAGE)
Write-Host "🖼️ Configuration du moteur IMAGE ($VRAM_PROFILE)..."
if ($VRAM_PROFILE -eq "STANDARD") {
    # SDXL ou SD v1.5 Haute Qualité
    Write-Host "✨ [Mode Standard] Préparation de Stable Diffusion XL (SDXL)..."
    # Note: Le téléchargement se fera au premier lancement par le creative_server.py
} else {
    # SSD-1B ou SD Turbo (Optimisé VRAM)
    Write-Host "⚡ [Mode Light] Préparation de SSD-1B / SD-Turbo..."
}

# 4. Vérification CUDA
Write-Host "🔍 Vérification de l'accélération matérielle..."
&$PYTHON_EXE -c "import torch; print('✅ CUDA disponible:', torch.cuda.is_available()); print('💾 VRAM Détectée:', torch.cuda.get_device_properties(0).total_memory / 1e9, 'GB') if torch.cuda.is_available() else print('⚠️ CUDA non trouvé, le rendu sera LENT (CPU)')"

Write-Host "✅ Installation terminée. Prêt pour le premier rendu créatif." -ForegroundColor Green
