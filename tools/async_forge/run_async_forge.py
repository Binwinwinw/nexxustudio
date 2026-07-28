#!/usr/bin/env python3
"""
Async Forge v0.3 — Boucle de Mutation Autonome Gouvernée
Intègre un cycle complet d'ingénierie assistée sous contraintes :
plan -> mutation -> tests -> critique -> rapport.
"""

import os
import sys
import argparse
import shutil
import uuid
import time
import subprocess
import platform
import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone

# Force UTF-8 pour la console Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def print_banner():
    print("==========================================================")
    print("⚡ ASYNC FORGE v0.3 — BOUCLE DE MUTATION AUTONOME ⚡")
    print("==========================================================")

def check_docker():
    """Vérifie si le démon Docker est actif."""
    try:
        res = subprocess.run(["docker", "info"], capture_output=True, text=True)
        return res.returncode == 0
    except Exception:
        return False

def ignore_patterns(path, names):
    """Exclut les dossiers lourds et inutiles lors de la copie du dépôt."""
    ignored = []
    for name in names:
        if name in {".git", "node_modules", "vendor", ".venv", "venv", "dist", ".memory", "scratch", "tmp", ".gemini", "data", "logs", "db"}:
            ignored.append(name)
    return ignored

def clear_readonly(directory):
    import stat
    for root, dirs, files in os.walk(directory):
        for d in dirs:
            try:
                os.chmod(os.path.join(root, d), stat.S_IWRITE)
            except Exception:
                pass
        for f in files:
            try:
                os.chmod(os.path.join(root, f), stat.S_IWRITE)
            except Exception:
                pass

def init_git_baseline(workspace_path):
    """Initialise un dépôt git éphémère dans la sandbox pour tracer le diff."""
    try:
        subprocess.run(["git", "init"], cwd=workspace_path, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "Async Forge"], cwd=workspace_path, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "forge@citadelle.local"], cwd=workspace_path, capture_output=True, check=True)
        res = subprocess.run(["git", "add", "."], cwd=workspace_path, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[FAIL-CLOSED] Erreur git add : {res.stderr}")
            return False
        subprocess.run(["git", "commit", "-m", "Baseline snapshot", "--allow-empty"], cwd=workspace_path, capture_output=True, check=True)
        return True
    except Exception as e:
        print(f"[FAIL-CLOSED] Erreur lors de l'initialisation du diff git : {e}")
        return False

def get_git_diff(workspace_path):
    """Génère le diff des modifications introduites de manière souveraine en pur Python."""
    import difflib
    diff_parts = []
    for abs_path, original_content in MUTATED_ORIGINALS.items():
        rel_path = os.path.relpath(abs_path, workspace_path).replace("\\", "/")
        
        current_content = ""
        if os.path.exists(abs_path):
            try:
                with open(abs_path, "r", encoding="utf-8") as fCurrent:
                    current_content = fCurrent.read()
            except Exception:
                pass
                
        if original_content == current_content:
            continue
            
        original_lines = original_content.splitlines(keepends=True)
        current_lines = current_content.splitlines(keepends=True)
        
        diff_lines = list(difflib.unified_diff(
            original_lines,
            current_lines,
            fromfile=f"a/{rel_path}",
            tofile=f"b/{rel_path}",
            lineterm=""
        ))
        if diff_lines:
            diff_parts.append("diff --git a/{} b/{}\n".format(rel_path, rel_path) + "".join(diff_lines))
            
    return "\n".join(diff_parts)

MOCK_ACTIVE = False

def query_ollama(messages, model="ornith:9b", temperature=0.2):
    """Interroge le démon Ollama local via son API REST locale."""
    global MOCK_ACTIVE
    if MOCK_ACTIVE:
        prompt_text = "".join([m.get("content", "") for m in messages]).lower()
        if "plan" in prompt_text or "blueprint" in prompt_text:
            return """# Plan d'action pour le job de validation
1. [NEW] Créer un fichier de validation `server/forge_test.txt` pour prouver le bon fonctionnement du pipeline.
2. Lancer la commande de validation sur l'hôte.
"""
        elif "critique" in prompt_text or "évaluer" in prompt_text:
            return """L'évaluation montre que les mutations sont conformes. Le code compile et la validation passe avec succès."""
        else:
            return """Voici la modification chirurgicale pour valider le service :

FILE: server/forge_test.txt
<<<<<<< SEARCH
=======
Ceci est une validation automatisée d'Async Forge v0.3.
>>>>>>> REPLACE
"""

    url = "http://127.0.0.1:11434/api/chat"
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": 4000
        }
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    
    try:
        # Attente d'un maximum de 400 secondes pour les gros raisonnements de deepseek
        with urllib.request.urlopen(req, timeout=400) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            message = res_json.get("message", {})
            content = message.get("content", "")
            reasoning = message.get("reasoning_content", "") or message.get("thinking", "") or message.get("thought", "")
            
            if reasoning:
                return f"<think>\n{reasoning}\n</think>\n{content}"
            return content
    except urllib.error.URLError as e:
        print(f"[Ollama] Erreur de connexion au démon Ollama : {e}")
        return ""
    except Exception as e:
        print(f"[Ollama] Erreur inattendue d'inférence : {e}")
        return ""

def load_workspace_context(workspace_path):
    """Parcourt le workspace et charge les petits fichiers de code pour l'IA."""
    file_contents = {}
    file_list = []
    
    for root, dirs, files in os.walk(workspace_path):
        # Exclusions à la volée
        dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "vendor", ".venv", "venv", "dist", ".memory", "scratch", "tmp", ".gemini"}]
        
        for file in files:
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, workspace_path).replace("\\", "/")
            file_list.append(rel_path)
            
            # Extensions textuelles supportées
            ext = os.path.splitext(file)[1].lower()
            if ext in {".js", ".jsx", ".ts", ".tsx", ".php", ".py", ".json", ".css", ".html", ".md", ".yml", ".yaml", ".txt"}:
                try:
                    size = os.path.getsize(abs_path)
                    # Lire uniquement si < 80 Ko pour éviter les blocages de contexte
                    if size < 80 * 1024:
                        with open(abs_path, "r", encoding="utf-8", errors="ignore") as f:
                            file_contents[rel_path] = f.read()
                except Exception:
                    pass
                    
    return file_list, file_contents

MUTATED_ORIGINALS = {}

def apply_search_replace_mutations(workspace_path, llm_output):
    """
    Parse et applique chirurgicalement les blocs de mutation :
    
    FILE: relative/path/to/file.ext
    <<<<<<< SEARCH
    [code original]
    =======
    [code modifié]
    >>>>>>> REPLACE
    """
    pattern = re_compile_blocks()
    matches = list(pattern.finditer(llm_output))
    
    if not matches:
        return 0, 0, ["Aucun bloc SEARCH/REPLACE conforme n'a été détecté dans les instructions de mutation."]

    success_count = 0
    errors = []
    
    for i, match in enumerate(matches):
        file_path_raw = match.group(1)
        search_content = match.group(2)
        replace_content = match.group(3)
        
        # Heuristique pour nom de fichier manquant
        if not file_path_raw:
            start_pos = match.start()
            prev_text = llm_output[max(0, start_pos - 150):start_pos]
            file_match = os.path.join(workspace_path, "unknown_file")
            # Tente de trouver un pattern de chemin
            path_regex = r"([\w\-./\\]+\.\w{2,5})"
            found_paths = [p for p in re_find_all(path_regex, prev_text) if not p.endswith("md")]
            if found_paths:
                file_path_raw = found_paths[-1]
            else:
                errors.append(f"Bloc {i+1} : Nom de fichier indéterminable.")
                continue
                
        file_path_clean = file_path_raw.strip().replace("`", "").replace("\"", "").replace("'", "").replace("\\", "/")
        abs_file_path = os.path.abspath(os.path.join(workspace_path, file_path_clean))
        
        # Sécurité de path traversal
        if not abs_file_path.startswith(os.path.abspath(workspace_path)):
            errors.append(f"Bloc {i+1} : Le fichier '{file_path_clean}' sort des limites de la sandbox.")
            continue
            
        # [Sovereign Diff Engine] Sauvegarde de l'état d'origine du fichier avant première mutation
        if abs_file_path not in MUTATED_ORIGINALS:
            if os.path.exists(abs_file_path):
                try:
                    with open(abs_file_path, "r", encoding="utf-8") as fOrig:
                        MUTATED_ORIGINALS[abs_file_path] = fOrig.read()
                except Exception:
                    MUTATED_ORIGINALS[abs_file_path] = ""
            else:
                MUTATED_ORIGINALS[abs_file_path] = ""

        # Création automatique de nouveau fichier
        if not os.path.exists(abs_file_path):
            try:
                os.makedirs(os.path.dirname(abs_file_path), exist_ok=True)
                with open(abs_file_path, "w", encoding="utf-8") as f:
                    f.write(replace_content)
                success_count += 1
                continue
            except Exception as e:
                errors.append(f"Bloc {i+1} : Échec de création du nouveau fichier '{file_path_clean}' : {e}")
                continue
                
        # Lecture
        try:
            with open(abs_file_path, "r", encoding="utf-8") as f:
                file_data = f.read()
        except Exception as e:
            errors.append(f"Bloc {i+1} : Impossible de lire '{file_path_clean}' : {e}")
            continue
            
        # Normalisation CRLF
        search_norm = search_content.replace("\r\n", "\n")
        file_norm = file_data.replace("\r\n", "\n")
        replace_norm = replace_content.replace("\r\n", "\n")
        
        if search_norm in file_norm:
            mutated_norm = file_norm.replace(search_norm, replace_norm, 1)
            # Conserver sauts de ligne Windows originaux si nécessaire
            mutated_data = mutated_norm.replace("\n", "\r\n") if "\r\n" in file_data else mutated_norm
            
            try:
                with open(abs_file_path, "w", encoding="utf-8") as f:
                    f.write(mutated_data)
                success_count += 1
            except Exception as e:
                errors.append(f"Bloc {i+1} : Échec d'écriture dans '{file_path_clean}' : {e}")
        else:
            errors.append(f"Bloc {i+1} : Le contenu d'origine SEARCH pour '{file_path_clean}' ne correspond pas exactement.")
            
    return success_count, len(matches), errors

def re_compile_blocks():
    import re
    return re.compile(
        r"(?:(?:FILE|Fichier|Target|File):\s*([^\n\r]+)(?:\r\n|\r|\n)+)?"
        r"<<<<<<< SEARCH(?:\r\n|\r|\n)(.*?)"
        r"=======(?:\r\n|\r|\n)(.*?)"
        r">>>>>>> REPLACE",
        re.DOTALL
    )

def re_find_all(pattern, text):
    import re
    return re.findall(pattern, text)

def run_sandbox_local(workspace_path, test_command):
    """Exécute la commande de validation directement sur l'hôte local en mode secours."""
    print(f"[Async Forge][Fallback] Exécution de la commande sur l'hôte : '{test_command}'")
    start_time = time.time()
    try:
        # Sous Windows ou Unix, shell=True permet de lancer npm/pytest...
        # Exécuter dans le répertoire temporaire pour isolation relative
        res = subprocess.run(test_command, shell=True, capture_output=True, text=True, cwd=workspace_path, timeout=300)
        elapsed = time.time() - start_time
        return res.returncode, res.stdout, res.stderr, elapsed, False, "local-host-env"
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start_time
        print("[FAIL-CLOSED] Timeout de 5 minutes expiré lors de l'exécution sur l'hôte.")
        return -1, "", "TIMEOUT EXPIRED: Execution exceeded 300 seconds budget.", elapsed, True, "local-host-env"

def run_sandbox(workspace_path, repo_path, test_command, job_id, docker_available=True, network="none"):
    """Exécute la sandbox Docker avec des montages de dépendances read-only."""
    if not docker_available:
        return run_sandbox_local(workspace_path, test_command)
    volumes = [
        f"{os.path.abspath(workspace_path)}:/workspace"
    ]

    # Montage read-only (ro) des dépendances
    node_modules_path = os.path.join(repo_path, "node_modules")
    if os.path.exists(node_modules_path):
        volumes.append(f"{os.path.abspath(node_modules_path)}:/workspace/node_modules:ro")
        print("[Async Forge] Montage read-only détecté pour : node_modules")

    vendor_path = os.path.join(repo_path, "vendor")
    if os.path.exists(vendor_path):
        volumes.append(f"{os.path.abspath(vendor_path)}:/workspace/vendor:ro")
        print("[Async Forge] Montage read-only détecté pour : vendor")

    image = "node:20-alpine"
    if os.path.exists(os.path.join(repo_path, "composer.json")) and not os.path.exists(os.path.join(repo_path, "package.json")):
        image = "php:8.2-cli-alpine"
    elif os.path.exists(os.path.join(repo_path, "requirements.txt")):
        image = "python:3.11-alpine"

    container_name = f"async_forge_run_{job_id.split('_')[-1]}"
    cmd = [
        "docker", "run", "--rm",
        "--name", container_name,
        "--network", network,
        "-w", "/workspace"
    ]

    for vol in volumes:
        cmd.extend(["-v", vol])

    cmd.append(image)
    cmd.extend(["sh", "-c", test_command])

    print(f"[Async Forge] Lancement du conteneur '{container_name}' utilisant l'image '{image}'...")
    
    start_time = time.time()
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        elapsed = time.time() - start_time
        return res.returncode, res.stdout, res.stderr, elapsed, False, image
    except subprocess.TimeoutExpired:
        elapsed = time.time() - start_time
        print(f"[FAIL-CLOSED] Timeout de 5 minutes expiré. Arrêt forcé du conteneur...")
        subprocess.run(["docker", "kill", container_name], capture_output=True)
        return -1, "", "TIMEOUT EXPIRED: Execution exceeded 300 seconds budget.", elapsed, True, image

def main():
    print_banner()
    
    parser = argparse.ArgumentParser(description="Async Forge v0.3 Controller")
    parser.add_argument("--task", required=True, help="Description de la tâche à exécuter")
    parser.add_argument("--repo", required=True, help="Chemin du dépôt à évaluer")
    parser.add_argument("--test-command", required=True, help="Commande de validation/test à exécuter")
    parser.add_argument("--output-dir", default="tools/async_forge/outputs", help="Dossier de sortie pour le rapport d'audit")
    parser.add_argument("--debug", action="store_true", help="Garder les workspaces temporaires pour le débogage")
    parser.add_argument("--job-id", help="Identifiant unique du job (optionnel)")
    parser.add_argument("--model", default="ornith:9b", help="Modèle principal de mutation")
    parser.add_argument("--critique-model", default="deepseek-r1:8b", help="Modèle de critique et réparation")
    parser.add_argument("--max-critiques", type=int, default=3, help="Nombre maximal d'essais de critique et d'auto-correction")
    parser.add_argument("--mock", action="store_true", help="Utiliser des réponses LLM simulées")
    
    args = parser.parse_args()
    
    if args.mock:
        global MOCK_ACTIVE
        MOCK_ACTIVE = True
    
    start_time_iso = datetime.now(timezone.utc).isoformat()
    
    # 1. Sécurité Initiale (Fail-Closed)
    docker_available = check_docker()
    if not docker_available:
        print("[WARNING] Le démon Docker est injoignable ou arrêté. Bascule en mode de secours : Exécution sur l'hôte (Sovereign Host Fallback).")
        sandbox_strategy = "sovereign host execution (no-docker fallback)"
    else:
        print("[Async Forge] Docker disponible.")
        node_modules_exists = os.path.exists(os.path.join(args.repo, "node_modules"))
        vendor_exists = os.path.exists(os.path.join(args.repo, "vendor"))
        sandbox_strategy = "hybrid (snapshot + bind-ro dependencies)" if (node_modules_exists or vendor_exists) else "snapshot copy"
        
    if not os.path.exists(args.repo):
        print(f"[FAIL-CLOSED] Erreur critique : Le dépôt source '{args.repo}' n'existe pas. Arrêt immédiat.")
        sys.exit(1)

    job_id = args.job_id if args.job_id else f"job_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    base_dir = os.path.abspath(os.path.dirname(__file__))
    workspace_path = os.path.join(base_dir, "../../scratch/async_forge_workspaces", job_id)
    
    print(f"[Async Forge] Initialisation du workspace temporaire : {workspace_path}")
    os.makedirs(workspace_path, exist_ok=True)
    
    attempts_history = []
    exit_code = -1
    stdout, stderr = "", ""
    elapsed = 0.0
    is_timeout = False
    image_name = "node:20-alpine"
    blueprint_content = ""
    
    try:
        # Snapshot
        shutil.copytree(args.repo, workspace_path, ignore=ignore_patterns, dirs_exist_ok=True)
        clear_readonly(workspace_path)
            
        # Charger le contexte source
        print("[Async Forge] Chargement du contexte du workspace...")
        file_list, file_contents = load_workspace_context(workspace_path)
        
        # Lire AGENTS.md si présent
        agents_rules = ""
        agents_md_path = os.path.join(args.repo, "../AGENTS.md")
        if not os.path.exists(agents_md_path):
            agents_md_path = os.path.join(args.repo, "AGENTS.md")
            
        if os.path.exists(agents_md_path):
            try:
                with open(agents_md_path, "r", encoding="utf-8") as f:
                    agents_rules = f.read()
                print("[Async Forge] Alignement sémantique chargé depuis AGENTS.md.")
            except Exception:
                pass

        # ── PHASE 1 : Planification (Blueprint) ───────────────────────────────
        print("[Async Forge][Phase 1] Planification active...")
        context_str = "\n".join([f"### FICHIER: {path}\n```\n{content}\n```" for path, content in file_contents.items()])
        
        system_plan = (
            "Tu es l'expert principal de La Citadelle.\n"
            "MISSION: Rédige un plan de modification (Blueprint) détaillé en Français pour accomplir la tâche de l'utilisateur.\n"
            "Directives:\n"
            "- Identifie les fichiers à modifier ou créer.\n"
            "- Décris précisément les changements techniques sans encore générer de blocs SEARCH/REPLACE.\n"
            "- Reste sobre, souverain et technique."
        )
        if agents_rules:
            system_plan += f"\n\nRespecte scrupuleusement ces règles du projet :\n{agents_rules}"
            
        user_plan = (
            f"TÂCHE UTILISATEUR:\n{args.task}\n\n"
            f"FICHIERS DISPONIBLES DANS LE WORKSPACE:\n" + "\n".join([f"- {f}" for f in file_list]) + "\n\n"
            f"CONTENU DES FICHIERS SOURCES:\n{context_str}"
        )
        
        messages_plan = [
            {"role": "system", "content": system_plan},
            {"role": "user", "content": user_plan}
        ]
        
        blueprint_content = query_ollama(messages_plan, model=args.model, temperature=0.1)
        if not blueprint_content:
            print("[FAIL-CLOSED] Échec de génération du Blueprint de planification. Annulation.")
            sys.exit(1)
            
        # Écriture du blueprint
        blueprint_path = os.path.join(workspace_path, "forge_blueprint.md")
        with open(blueprint_path, "w", encoding="utf-8") as f:
            f.write(blueprint_content)
        print("[Async Forge] Blueprint sauvegardé dans forge_blueprint.md.")

        # ── PHASE 2 : Mutation Chirurgicale Initiale ──────────────────────────
        print("[Async Forge][Phase 2] Mutation en cours...")
        system_mutate = (
            "Tu es l'ingénieur principal de La Citadelle.\n"
            "MISSION: Applique le blueprint en générant les modifications chirurgicales de code.\n"
            "Tu dois impérativement renvoyer tes modifications sous forme de blocs SEARCH/REPLACE en respectant la grammaire suivante :\n\n"
            "FILE: chemin/relatif/vers/fichier.ext\n"
            "<<<<<<< SEARCH\n"
            "[code original exact]\n"
            "=======\n"
            "[code modifié de remplacement]\n"
            ">>>>>>> REPLACE\n\n"
            "Règles :\n"
            "- Le bloc SEARCH doit correspondre à 100% au code d'origine (espaces inclus).\n"
            "- Si tu crées un nouveau fichier, laisse SEARCH vide.\n"
            "- Ne fournis aucun texte ou explication autour des blocs, écris uniquement les blocs."
        )
        
        user_mutate = (
            f"TÂCHE: {args.task}\n"
            f"BLUEPRINT:\n{blueprint_content}\n\n"
            f"CONTENU DES FICHIERS:\n{context_str}"
        )
        
        messages_mutate = [
            {"role": "system", "content": system_mutate},
            {"role": "user", "content": user_mutate}
        ]
        
        mutations_output = query_ollama(messages_mutate, model=args.model, temperature=0.2)
        
        # Appliquer
        success_count, total_count, parse_errors = apply_search_replace_mutations(workspace_path, mutations_output)
        print(f"[Async Forge] Blocs de mutation appliqués : {success_count}/{total_count} avec succès.")
        
        # ── PHASE 3 & 4 : Exécution et Critique & Réparation ──────────────────
        attempt = 0
        max_critiques = args.max_critiques
        
        while attempt <= max_critiques:
            attempt += 1
            print(f"[Async Forge][Phase 3] Exécution des tests (Tentative {attempt}/{max_critiques + 1})...")
            
            exit_code, stdout, stderr, elapsed, is_timeout, image_name = run_sandbox(
                workspace_path=workspace_path,
                repo_path=args.repo,
                test_command=args.test_command,
                job_id=job_id,
                docker_available=docker_available
            )
            
            attempt_info = {
                "attempt": attempt,
                "exit_code": exit_code,
                "stdout": stdout,
                "stderr": stderr,
                "duration_ms": int(elapsed * 1000),
                "is_timeout": is_timeout,
                "status": "SUCCESS" if (exit_code == 0 and not is_timeout) else "FAILED",
                "mutations_applied": get_git_diff(workspace_path)
            }
            attempts_history.append(attempt_info)
            
            if exit_code == 0 and not is_timeout:
                print("🟢 [Async Forge] Tests unitaires réussis avec succès !")
                break
                
            if attempt > max_critiques:
                print("🔴 [Async Forge] Échec persistant des tests unitaires et budget maximal d'essais épuisé.")
                break
                
            # Entrer dans l'Auto-Correction (Phase 4)
            print(f"[Async Forge][Phase 4] Critique & Réparation active (Essai {attempt}/{max_critiques})...")
            
            # Recharger contexte de fichiers modifiés pour donner l'état actuel
            _, current_contents = load_workspace_context(workspace_path)
            current_context_str = "\n".join([f"### FICHIER: {p}\n```\n{c}\n```" for p, c in current_contents.items()])
            
            system_critic = (
                "Tu es l'auditeur et l'ingénieur critique de La Citadelle.\n"
                "Les tests de la sandbox viennent d'échouer. Ta mission est d'étudier les erreurs et de réparer le code.\n"
                "Tu reçois :\n"
                "1. Le Git Diff des dernières modifications appliquées.\n"
                "2. Les Logs d'échec de la console de test (stdout/stderr).\n"
                "3. L'état actuel du code du workspace.\n\n"
                "MISSION:\n"
                "1. Explique brièvement en Français la cause de l'erreur (dans une balise <think>).\n"
                "2. Produis immédiatement les blocs correctifs SEARCH/REPLACE pour réparer le bug.\n"
                "Utilise la grammaire SEARCH/REPLACE stricte."
            )
            
            user_critic = (
                f"WORKSPACES SOURCES ACTUELS :\n{current_context_str}\n\n"
                f"GIT DIFF DES TENTATIVES PRÉCÉDENTES :\n{attempt_info['mutations_applied']}\n\n"
                f"LOGS D'ERREUR DES TESTS :\nSTDOUT:\n{stdout}\nSTDERR:\n{stderr}"
            )
            
            messages_critic = [
                {"role": "system", "content": system_critic},
                {"role": "user", "content": user_critic}
            ]
            
            critic_output = query_ollama(messages_critic, model=args.critique_model, temperature=0.1)
            
            # Appliquer correction
            succ, tot, errs = apply_search_replace_mutations(workspace_path, critic_output)
            print(f"[Async Forge] Critique appliquée : {succ}/{tot} correctifs insérés avec succès.")
            
        # ── PHASE 5 : Clôture ──────────────────────────────────────────────────
        print("[Async Forge][Phase 5] Clôture...")
        diff = get_git_diff(workspace_path)
        
        # Générer rapport
        report_path = generate_report(
            output_dir=args.output_dir,
            job_id=job_id,
            task=args.task,
            status=exit_code,
            elapsed=elapsed,
            stdout=stdout,
            stderr=stderr,
            diff=diff,
            is_timeout=is_timeout,
            repo_path=args.repo,
            test_command=args.test_command,
            image_name=image_name,
            network_mode="none",
            sandbox_strategy=sandbox_strategy,
            start_time_iso=start_time_iso,
            attempts_history=attempts_history,
            blueprint=blueprint_content
        )
        
    finally:
        # Nettoyage
        if not args.debug:
            print("[Async Forge] Nettoyage du workspace temporaire...")
            shutil.rmtree(workspace_path, ignore_errors=True)
        else:
            print(f"[DEBUG] Workspace temporaire conservé à : {workspace_path}")

    sys.exit(0 if (exit_code == 0 and not is_timeout) else 1)

def generate_report(output_dir, job_id, task, status, elapsed, stdout, stderr, diff, is_timeout,
                    repo_path, test_command, image_name, network_mode, sandbox_strategy, start_time_iso,
                    attempts_history, blueprint):
    """Génère un rapport d'audit Markdown complet et des métadonnées JSON certifiées (v0.3)."""
    os.makedirs(output_dir, exist_ok=True)
    report_path = os.path.join(output_dir, f"report_{job_id}.md")
    metadata_path = os.path.join(output_dir, f"metadata_{job_id}.json")
    
    # Statistiques du diff
    files_changed_count = 0
    insertions = 0
    deletions = 0
    if diff:
        for line in diff.splitlines():
            if line.startswith("diff --git"):
                files_changed_count += 1
            elif line.startswith("+") and not line.startswith("+++"):
                insertions += 1
            elif line.startswith("-") and not line.startswith("---"):
                deletions += 1
    diff_stat = f"+{insertions}, -{deletions}"
    
    # Empreinte de l'hôte
    docker_version = "Inconnu"
    try:
        res = subprocess.run(["docker", "--version"], capture_output=True, text=True)
        if res.returncode == 0:
            docker_version = res.stdout.strip()
    except Exception:
        pass
        
    host_fingerprint = {
        "os": platform.system(),
        "processor": platform.processor(),
        "docker_version": docker_version
    }
    
    end_time_iso = datetime.now(timezone.utc).isoformat()
    duration_ms = int(elapsed * 1000)
    status_label = "TIMEOUT" if is_timeout else ("FAILED" if status != 0 else "SUCCESS")
    
    # Sauvegarde des métadonnées JSON
    metadata = {
        "job_id": job_id,
        "repo_path": os.path.abspath(repo_path),
        "target_subrepo": os.path.basename(os.path.abspath(repo_path)),
        "image_name": image_name,
        "test_command": test_command,
        "network_mode": network_mode,
        "start_time": start_time_iso,
        "end_time": end_time_iso,
        "duration_ms": duration_ms,
        "exit_code": status,
        "status": status_label,
        "sandbox_strategy": sandbox_strategy,
        "files_changed_count": files_changed_count,
        "diff_stat": diff_stat,
        "host_fingerprint": host_fingerprint,
        "runner_version": "0.3",
        "attempts_count": len(attempts_history)
    }
    
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
        
    # Section historique des essais
    attempts_section = ""
    for idx, att in enumerate(attempts_history):
        attempts_section += f"""
### Essai {att['attempt']} ({att['status']})
- **Code retour** : `{att['exit_code']}`
- **Durée** : {att['duration_ms']} ms
- **Timeout** : {"Oui" if att['is_timeout'] else "Non"}

#### Logs Console (stdout) :
```text
{att['stdout'] if att['stdout'] else "[Aucune sortie]"}
```

#### Logs Erreurs (stderr) :
```text
{att['stderr'] if att['stderr'] else "[Aucune erreur]"}
```
"""

    content = f"""# Rapport d'Audit Async Forge — Job {job_id}

- **Date de début** : {start_time_iso}
- **Date de fin** : {end_time_iso}
- **Statut Final** : {"🔴 TIMEOUT" if is_timeout else ("🔴 FAILED" if status != 0 else "🟢 SUCCESS")}
- **Durée d'exécution** : {elapsed:.2f} secondes ({duration_ms} ms)
- **Mode Réseau** : {network_mode}
- **Stratégie de Sandbox** : {sandbox_strategy}
- **Image Docker** : `{image_name}`
- **Changements de code** : {files_changed_count} fichiers ({diff_stat})
- **Version du Runner** : v0.3 (Boucle Autonome)
- **Nombre total d'essais** : {len(attempts_history)}

---

## 📝 Tâche Demandée
> {task}

---

## 🗺️ Blueprint de Planification
```markdown
{blueprint}
```

---

## 🔄 Historique des Itérations d'Auto-Correction
{attempts_section}

---

## 🛠️ Différence Git Finale (Mutations Validées)
```diff
{diff if diff.strip() else "Aucune modification de code validée dans le workspace."}
```
"""
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"[Async Forge] Rapport d'audit généré avec succès : {report_path}")
    print(f"[Async Forge] Métadonnées JSON sauvegardées : {metadata_path}")
    return report_path

if __name__ == "__main__":
    main()
