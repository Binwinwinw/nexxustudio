# PLAN — Local Model Manager (LMM)

## 1. Contexte

**Nexxus Studio** est une application multi-agents dotée d'une architecture en tiers :

- **Tier-1** : modèle ultra-rapide pour le boot (ex : `qwen3.5:2b`)
- **Tier-2** : modèle intermédiaire chargé en différé (ex : `granite4.1:8b`)
- **Tier-3** : experts spécialisés chargés à la demande (lazy)

L'application inclut également :

- Un orchestrateur central ("Nexxus Citadel Core")
- Un routeur d'experts avec métadonnées et embeddings
- Un Knowledge Hub basé sur ChromaDB
- Un serveur AirLLM pour l'inférence alternative
- Un serveur "creative" dédié
- Un système de sécurité (JWT, AES-256-GCM, tokens internes)
- Un monitoring thermique et VRAM

**Environnement** :

- Ollama 0.33.3
- RTX 4060 (8 GB VRAM)
- Windows 11 + PowerShell
- ChromaDB (port 8008)
- AirLLM (port 11436)
- Creative server (port 11437)
- Backend Nexxus (port 3000)
- Frontend Vite (port 5173)

**Contrainte principale** : 8 GB de VRAM = 2 modèles maximum chargés simultanément. Chaque switch de modèle coûte 10 à 60 secondes de chargement.

## 2. Problème identifié

Le **temps de chargement des modèles** est le goulot d'étranglement principal. Sur une session de travail de 3-4 heures avec plusieurs switchs, cela représente des minutes perdues.

Le coût des tokens en local est négligeable (pas de facturation API), donc le vrai enjeu est le **temps**, pas le **coût**.

**Objectif mesurable** : réduire de 80% le temps d'attente lié aux chargements.

## 3. Objectifs du LMM

Quatre objectifs complémentaires :

1. **Documenter les performances des experts** (benchmarks reproductibles, historiques, comparaisons).
2. **Choisir les experts optimaux pour chaque tâche** (routage intelligent selon le type de travail).
3. **Optimiser le placement VRAM** (8 GB, 2 modèles max, coordination avec Nexxus Studio).
4. **Créer automatiquement les versions 16K** des modèles pour garantir un contexte suffisant en local.

## 4. Situation actuelle

### Modèles 16K déjà créés

Via le script `create_ollama_16k.py` (déjà fonctionnel, supporte `--dry-run`, `--force`, `--only`) :

| Modèle              | Taille | Contexte | Notes                                 |
| ------------------- | ------ | -------- | ------------------------------------- |
| `gemma4-26b-16k`    | 17 GB  | 16 384   | Qualité maximale, déborde CPU         |
| `glm-4.7-flash-16k` | 19 GB  | 16 384   | Excellent tool calling, déborde CPU   |
| `qwen3.5-9b-16k`    | 6,6 GB | 16 384   | Meilleur compromis (100% GPU)         |
| `gemma4-12b-16k`    | 7,6 GB | 16 384   | Bon compromis                         |
| `granite4.1-8b-16k` | 5,3 GB | 16 384   | Très rapide                           |
| `hermes3-8b-16k`    | 4,7 GB | 16 384   | Bon tool calling                      |
| `qwen3.5-2b-16k`    | 2,7 GB | 16 384   | Ultra-léger (délires en tool calling) |

### Modèles exclus (raisons)

- `deepseek-r1:8b` : raisonnement pur, pas de tool calling.
- `qwen2.5-coder:7b` : mauvais en tool calling via Ollama.
- `glm-ocr:*`, `deepseek-ocr` : OCR, pas de chat.
- `qwen3-embedding`, `nomic-embed-text` : embeddings uniquement.
- `llama3.2-vision`, `llama3.1` : anciens, moins performants.

### Système de warmup actuel de Nexxus

```
[Warmup] ⚡ Neural Matrix — profil REACTIVE
         (Tier1 boot, Tier2 deferred (granite4.1:8b), Tier3 lazy)

[Warmup][TIER-1] 🔥 Priming qwen3.5:2b + embeddings...
[Warmup] ✅ Ready for traffic (8795ms)

[Warmup][TIER-3] ❄️ Experts lazy: qwen2.5-coder:7b, gemma4:12b,
                 glm-ocr:q8_0, nexxus-vox:latest
```

**Profil `reactive`** : 12 modèles planifiés.

## 5. Architecture proposée

### Composant 1 : Registre des experts (`experts.yaml`)

Documente chaque expert avec ses métadonnées :

```yaml
experts:
  qwen3.5-9b-16k:
    role: "Généraliste"
    tier: 2
    vram: 6.6
    context: 16384
    tasks:
      - code
      - analyse
      - tool_calling
    performances:
      vitesse: 7/10
      qualite: 9/10
      tool_calling: 9/10
    benchmark_history:
      - date: 2026-09-10
        task: "refactor cv-core.js"
        duration: 12s
        quality: 8/10
```

### Composant 2 : Moteur de benchmark

Teste automatiquement les experts sur des tâches types :

- **Génération de code** : "Écris une fonction Python qui calcule la suite de Fibonacci"
- **Refactoring** : "Refactorise cette fonction pour la rendre plus lisible: {code}"
- **Analyse** : "Explique ce que fait ce fichier en 5 phrases: {code}"
- **Tool calling** : "Crée un fichier test.txt contenant 'hello'"

**Méthodes d'évaluation** :

- Exact match (pour code déterministe)
- LLM judge (un modèle juge un autre)
- Heuristique (longueur, mots-clés)
- Notation manuelle (pour les cas critiques)

### Composant 3 : Analyseur VRAM

Suggère la meilleure combinaison d'experts à charger selon les contraintes :

```python
def suggest_placement(experts, max_vram=8, max_models=2):
    """
    Retourne la meilleure combinaison d'experts à charger.
    Contrainte : 2 modèles max, 8 GB total.
    """
    return {
        "tier1": "qwen3.5-2b",       # 2.7 GB - boot rapide
        "tier2": "qwen3.5-9b-16k",   # 6.6 GB - généraliste
        "total_vram": 9.3,            # ⚠️ Débordement de 1.3 GB
        "alternative": "granite4.1-8b-16k",  # 5.3 GB → 8.0 GB total
    }
```

### Composant 4 : Créateur 16K

Automatise la création des versions 16K manquantes (basé sur le script existant).

```python
def ensure_16k(model_name):
    version_16k = f"{model_name}-16k"
    if not exists(version_16k):
        create(model_name, version_16k, context=16384)
    return version_16k
```

### Composant 5 : Routeur de tâches

Choisit le bon expert selon la tâche, l'historique et la VRAM disponible.

```python
def route(task_description, available_experts):
    return {
        "expert": "qwen3.5-9b-16k",
        "reason": "Meilleur score sur les tâches de code",
        "estimated_time": "12s",
        "estimated_quality": "8/10",
    }
```

## 6. Format du rapport de benchmark

Rapport Markdown généré automatiquement avec :

- **Résumé** : tableau (expert, VRAM, vitesse, qualité, tool calling, score)
- **Recommandations par tâche** : meilleur, fallback, à éviter
- **Placement VRAM optimal** : configuration actuelle, suggestions, alertes
- **Détails des tests** : prompt, temps, qualité observée

### Exemple de tableau

| Expert              | VRAM   | Vitesse | Qualité | Tool Calling | Score |
| ------------------- | ------ | ------- | ------- | ------------ | ----- |
| `qwen3.5-2b-16k`    | 2.7 GB | 9/10    | 6/10    | 5/10         | 6.7   |
| `granite4.1-8b-16k` | 5.3 GB | 8/10    | 8/10    | 8/10         | 8.0   |
| `gemma4-12b-16k`    | 7.6 GB | 6/10    | 9/10    | 8/10         | 7.7   |
| `qwen3.5-9b-16k`    | 6.6 GB | 7/10    | 9/10    | 9/10         | 8.3   |
| `gemma4-26b-16k`    | 17 GB  | 3/10    | 10/10   | 9/10         | 7.3   |

## 7. Intégration avec Nexxus Studio

- **Partage du registre** : `experts.yaml` utilisé par Nexxus ET le LMM.
- **Coordination VRAM** : le LMM peut demander à Nexxus de décharger un expert.
- **Historique commun** : les benchmarks alimentent le `cleanup_by` de Nexxus.
- **Profils partagés** : `balanced`, `reactive` sont utilisés par les deux.
- **Workflow type** : `detect → benchmark → create-16k → optimize-vram → suggest`.

### Points d'intégration identifiés

| Point                        | Description                                |
| ---------------------------- | ------------------------------------------ |
| **OLLAMA_MAX_LOADED_MODELS** | Actuellement à 2 dans Nexxus               |
| **Cleanup_by**               | Cycle de vie des modèles (ex : 2026-08-24) |
| **Placement plan**           | 12 modèles planifiés selon profil          |
| **Tier system**              | Coordination Tier-1/2/3 avec LMM           |
| **ChromaDB**                 | Base vectorielle pour le RAG               |

## 8. Roadmap

### Phase 1 : MVP (1-2 semaines)

- [ ] Détection Ollama + experts Nexxus
- [ ] Création 16K automatique
- [ ] Benchmark basique (3-5 tâches)
- [ ] Rapport Markdown

### Phase 2 : Intelligence (2-3 semaines)

- [ ] Registre des experts avec historique
- [ ] Analyse VRAM et recommandations
- [ ] Routeur de tâches
- [ ] Intégration OpenCode

### Phase 3 : Intégration Nexxus (2-3 semaines)

- [ ] Coordination VRAM avec Nexxus
- [ ] Profils partagés
- [ ] Historique commun
- [ ] API interne

### Phase 4 : UX (2-3 semaines)

- [ ] TUI (textual)
- [ ] Export JSON/HTML
- [ ] Alertes et notifications
- [ ] Distribution (Scoop, PyPI)

## 9. Décisions en attente

Questions ouvertes à trancher :

1. **Format du registre** : YAML, JSON ou TOML ?
2. **Tâches de benchmark** : définies manuellement ou set par défaut ?
3. **Méthode d'évaluation** : exact match, LLM judge, heuristique ou notation manuelle ?
4. **Périmètre minimal du MVP** : quel est le plus petit ensemble utile ?
5. **Nom définitif** : Local Model Manager, Nexxus Model Manager, autre ?
6. **Open source ou privé** ?
7. **Interface** : CLI d'abord ou TUI dès le début ?
8. **Dépôt** : projet séparé ou intégré à Nexxus Studio ?

## 10. Leçons tirées de la session

- **Les modèles 2-3B sont inutilisables** pour le tool calling structuré (hallucinations, confusion, délires). Le seuil de fiabilité est autour de **7-9B paramètres**.
- **Les MCP ajoutent massivement du contexte** : ~8 000 tokens pour ~70 outils. Cela pénalise les petits modèles et peut faire perdre le fil aux gros.
- **La VRAM doit être surveillée** avec `nvidia-smi` et les modèles déchargés avec `ollama stop`.
- **Les variables d'environnement Ollama** (`OLLAMA_CONTEXT_LENGTH`, `OLLAMA_KEEP_ALIVE`, `OLLAMA_MAX_LOADED_MODELS`, `OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE`) sont essentielles pour optimiser l'usage VRAM.
- **Les modèles 16K partagent leurs blobs** avec les originaux : pas de duplication sur le disque.
- **`ollama launch opencode`** écrase la configuration OpenCode (MCP, modèle par défaut). À utiliser avec précaution.
- **Les tâches multi-étapes longues** sont difficiles pour les modèles locaux, même 26B. Il faut **découper en petits messages**.
- **Pour les tâches critiques** (Git, déploiement, sécurité), préférer **GitKraken** ou faire **manuellement**.
- **OpenCode + Ollama** est viable pour des tâches courtes et directives, mais fragile pour les tâches longues.

## 11. Ressources

### Scripts

- `create_ollama_16k.py` : création automatique des versions 16K.
- `switch-model.ps1` : changer le modèle par défaut d'OpenCode (à créer).
- `PLAN.md` : ce fichier.

### Configuration OpenCode

- `~/.config/opencode/opencode.json` : configuration principale.
- Modèle par défaut recommandé : `ollama/qwen3.5-9b-16k`.
- MCP utiles : GitKraken (actif).

### Variables d'environnement Ollama

```powershell
OLLAMA_CONTEXT_LENGTH=16384
OLLAMA_KEEP_ALIVE=1m
OLLAMA_MAX_LOADED_MODELS=1  # ou 2 pour Nexxus
OLLAMA_FLASH_ATTENTION=1
OLLAMA_KV_CACHE_TYPE=q8_0
```

### Commandes utiles

```powershell
# État des modèles chargés
ollama ps

# VRAM utilisée/libre
nvidia-smi --query-gpu=memory.used,memory.free --format=csv

# Décharger un modèle
ollama stop <nom>

# Créer une version 16K
python create_ollama_16k.py --only <nom-base>

# Lancer OpenCode avec un modèle spécifique
opencode -m ollama/<nom-modele>

# Redémarrer Ollama
Get-Process ollama*,llama-server* | Stop-Process -Force; Start-Sleep 3; ollama serve
```

---

**Document créé le** : 2026-09-10
**Dernière mise à jour** : 2026-09-10
**Auteur** : Binwinwinw
**Statut** : En cours de conception
**Projet concerné** : Nexxus Studio
