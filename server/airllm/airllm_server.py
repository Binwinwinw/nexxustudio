# server/airllm/airllm_server.py
import os
import json
import time
import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from dotenv import load_dotenv

# --- INSTRUMENTATION START ---
import time as time_module
start_time = time_module.perf_counter()

load_dotenv()

app = FastAPI(title="Nexxus AirLLM Optimizer Server")

# Modèles chargés dynamiquement pour économiser la RAM au démarrage
loaded_models = {}

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    stream: Optional[bool] = False
    options: Optional[dict] = {}
    keep_alive: Optional[int] = 1800

def get_model(model_name: str):
    if model_name not in loaded_models:
        # LAZY IMPORT: On n'importe la lourdeur que si on en a vraiment besoin
        print(f"[AirLLM] First heavy import starting for {model_name}...")
        try:
            from airllm import AutoModel
            print(f"[AirLLM] Loading weights into RAM (Sharded Mode)...")
            model = AutoModel.from_pretrained(model_name)
            loaded_models[model_name] = model
        except Exception as e:
            print(f"Error loading model {model_name}: {e}")
            return None
    return loaded_models[model_name]

@app.get("/api/tags")
async def get_tags():
    """Health check endpoint expected by Nexxus-Core"""
    return {
        "models": [
            {"name": name, "status": "loaded"} for name in loaded_models.keys()
        ],
        "status": "online",
        "engine": "AirLLM v2.8.x"
    }

@app.get("/api/health")
async def health():
    return {"status": "ready", "uptime": time_module.perf_counter() - start_time}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    model_name = request.model
    
    # Simuler le comportement d'unload si messages vides
    if not request.messages:
        if model_name in loaded_models:
            print(f"🧹 Unloading {model_name}...")
            del loaded_models[model_name]
        return {"status": "unloaded"}

    if request.stream:
        async def generate_stream():
            full_response = f"[Nexxus Optimizer] Flux actif. (Mode Sharded RAM)"
            for token in full_response.split():
                chunk = {
                    "model": model_name,
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "message": {"role": "assistant", "content": token + " "},
                    "done": False
                }
                yield json.dumps(chunk) + "\n"
                await asyncio.sleep(0.05)
            
            yield json.dumps({"model": model_name, "done": True}) + "\n"

        return StreamingResponse(generate_stream(), media_type="application/x-ndjson")
    else:
        return {
            "model": model_name,
            "message": {
                "role": "assistant",
                "content": f"[Nexxus Optimizer] Réponse statique (Mode Sharded RAM)."
            },
            "done": True
        }

if __name__ == "__main__":
    port = int(os.getenv("AIRLLM_PORT", 11436))
    print(f"[Startup] Core services ready in {time_module.perf_counter() - start_time:.4f}s")
    print(f"AirLLM Optimizer starting on port {port}...")
    # Désactivation de access_log pour un boot plus rapide
    uvicorn.run(app, host="0.0.0.0", port=port, access_log=False, workers=1)
