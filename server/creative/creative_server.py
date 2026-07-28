# server/creative/creative_server.py
import os
import time
import json
import base64
from io import BytesIO
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

# Les imports lourds sont faits à la demande (Lazy)
loaded_pipelines = {}

load_dotenv()

app = FastAPI(title="Nexxus Creative Hub (Vague 5)")

class ImageRequest(BaseModel):
    prompt: str
    size: str = "512x512"
    negative_prompt: str = ""
    profile: str = "LIGHT"

class AudioRequest(BaseModel):
    prompt: str
    duration: int = 10

def get_image_pipeline(profile="LIGHT"):
    if "image" not in loaded_pipelines:
        print(f"[Creative] Chargement du moteur IMAGE (Profil: {profile})...")
        from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
        import torch
        
        model_id = "segmind/SSD-1B" if profile == "LIGHT" else "stabilityai/stable-diffusion-2-1"
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32
        
        pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=dtype)
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
        pipe = pipe.to(device)
        
        if device == "cuda":
            pipe.enable_attention_slicing()
        
        loaded_pipelines["image"] = pipe
    return loaded_pipelines["image"]

def get_audio_model():
    if "audio" not in loaded_pipelines:
        print(f"[Creative] Chargement du moteur AUDIO (MusicGen via Transformers)...")
        from transformers import MusicgenForConditionalGeneration, AutoProcessor
        import torch
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
        processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
        
        loaded_pipelines["audio"] = {"model": model.to(device), "processor": processor}
    return loaded_pipelines["audio"]

@app.get("/health")
async def health():
    return {"status": "ready", "engines": list(loaded_pipelines.keys()), "vram_status": "optimized"}

@app.post("/generate/image")
async def generate_image(request: ImageRequest):
    print(f"[Creative-Local] Génération image: {request.prompt}")
    
    try:
        pipe = get_image_pipeline(request.profile)
        
        # Génération
        image = pipe(
            request.prompt, 
            negative_prompt=request.negative_prompt,
            num_inference_steps=20 if request.profile == "LIGHT" else 30
        ).images[0]
        
        # Sauvegarde
        filename = f"gen_{int(time.time())}.png"
        output_path = os.path.join("../../citadelle-vault/Citadelle/01-Architecture/03-Forge/media", filename)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        image.save(output_path)
        
        return {
            "success": True,
            "mode": "local",
            "engine": "StableDiffusion-SSD1B" if request.profile == "LIGHT" else "SD2.1",
            "filename": filename,
            "status": "completed"
        }
    except Exception as e:
        print(f"Error Erreur génération image: {e}")
        return {"success": False, "error": str(e)}

@app.post("/generate/audio")
async def generate_audio(request: AudioRequest):
    print(f"[Creative-Local] Génération audio: {request.prompt}")
    
    try:
        engine = get_audio_model()
        model = engine["model"]
        processor = engine["processor"]
        
        inputs = processor(
            text=[request.prompt],
            padding=True,
            return_tensors="pt",
        ).to(model.device)
        
        import torch
        with torch.no_grad():
            audio_values = model.generate(**inputs, max_new_tokens=int(request.duration * 50)) # ~50 tokens/sec
        
        # Sauvegarde au format WAV via scipy (plus léger que torchaudio)
        import scipy.io.wavfile
        filename = f"gen_{int(time.time())}.wav"
        output_path = os.path.join("../../citadelle-vault/Citadelle/01-Architecture/03-Forge/media", filename)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        sampling_rate = model.config.audio_encoder.sampling_rate
        scipy.io.wavfile.write(output_path, rate=sampling_rate, data=audio_values[0, 0].cpu().numpy())
        
        return {
            "success": True,
            "mode": "local",
            "engine": "MusicGen-Small-Transformers",
            "filename": filename,
            "status": "completed"
        }
    except Exception as e:
        print(f"Error Erreur génération audio: {e}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    port = int(os.getenv("CREATIVE_PORT", 11437))
    print(f"[*] Nexxus Creative Server starting on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port, access_log=False)
