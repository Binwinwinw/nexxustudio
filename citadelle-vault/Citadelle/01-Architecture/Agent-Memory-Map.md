# Agent Memory Map — Carte, vault humain, services

**Date** : 2026-07-28  
**Statut** : Index durable (humain)  
**Périmètre** : Runtime agent La Citadelle, capabilities, OCR/vision

Ce document relie **trois mémoires complémentaires**. Ne pas les fusionner en un seul dossier : l’export Graphify noie vite les ADR si on le mélange au vault principal.

---

## 1. Trois couches

| Couche | Rôle | Où |
|--------|------|-----|
| **Graphe (Graphify)** | *Where* — structure AST, impact, appels | `server/graphify-out/graph.json` (sync depuis `server/src/agent/graphify-out/` après update) |
| **Vault auto (export Obsidian)** | *Carte navigable* — wikilinks par nœud | `graphify-vault/server-agent/` (hors `citadelle-vault`) |
| **Vault humain + specs** | *Why* — ADR, contrats, décisions courtes | `citadelle-vault/Citadelle/`, `.memory/decisions.md`, `docs/agents/` |

**Services séparés (pas dans le graphe AST)** :

| Service | Rôle |
|---------|------|
| **Vision (Ollama)** | Image scène / briefing multimodal — contrat `VISION_ATTACHED` |
| **ocr-service (HTTP)** | Documents / transcription — capability `tool.ocr` |
| **LLM composeur** | Voix publique — nécessite Ollama (11434) sauf chemins déterministes |

---

## 2. Chemins runtime (La Citadelle)

```text
nexxustudio/
  server/src/agent/graphify-out/     ← sortie directe de graphify update src/agent
  server/graphify-out/graph.json     ← copie runtime (tool.graphify / tests P1)
  graphify-vault/server-agent/       ← export Obsidian Graphify (dédié, voir README)
  citadelle-vault/Citadelle/04-Graphify-Auto/  ← import quarantaine (merge-graphify-vault.ps1)
  citadelle-vault/Citadelle/         ← vault humain (ADR, specs)
  ocr-service/                       ← micro-service Unlimited-OCR
  docs/agents/                       ← specs capability packs, OCR
  .memory/decisions.md               ← décisions courtes opératoires
  server/src/agent/                  ← périmètre scan Graphify recommandé
```

### Regénérer la carte (narrow first)

Script local (Windows) — **commande stabilisée** :

```powershell
pwsh -File server/scripts/refresh-graphify-agent.ps1
# Export Obsidian si ta CLI le supporte :
pwsh -File server/scripts/refresh-graphify-agent.ps1 -TryObsidian
```

**Import dans Citadelle (quarantaine, pas fusion racine)** :

```powershell
pwsh -File server/scripts/merge-graphify-vault.ps1 -DryRun   # preview
pwsh -File server/scripts/merge-graphify-vault.ps1             # après export Obsidian
# Sans export Obsidian encore :
pwsh -File server/scripts/merge-graphify-vault.ps1 -BootstrapFromAgentOut
```

Cible : `citadelle-vault/Citadelle/04-Graphify-Auto/` — index [[01-Architecture/Graphify-Auto-Index]].

Manuel (équivalent) :

```bash
cd server
graphify update src/agent --force
# copier src/agent/graphify-out/graph.json → graphify-out/graph.json
```

**Export Obsidian (CLI locale, 2026-07-28)** : `graphify update … --obsidian` → *unknown option* ; le tip post-build mentionne `--obsidian` mais la version packagée ne l’expose pas encore. Cible future : `graphify-vault/server-agent/` (README à la racine repo). En attendant : `GRAPH_REPORT.md` + `graph.html` dans `server/src/agent/graphify-out/`.

Validation rapide :

```bash
cd server
graphify explain ocrVisionFallback --graph src/agent/graphify-out/graph.json
graphify query "vision OCR fallback agentPipeline" --graph src/agent/graphify-out/graph.json --budget 4000
```

Variables serveur utiles :

- `GRAPHIFY_GRAPH_PATH` → chemin vers `graph.json`
- `GRAPHIFY_MAX_AGE_MS` → fraîcheur avant désactivation `tool.graphify`
- `OCR_SERVICE_URL` → fallback / `tool.ocr` (ex. `http://127.0.0.1:8765`)
- `OLLAMA_HOST` → vision + composeur

---

## 3. Intent → outil (résumé)

| Intent / situation | Capability / pipeline | Ne pas utiliser pour |
|--------------------|------------------------|----------------------|
| REPO, impact, « qui appelle », architecture code | **tool.graphify** (`graph_query`, `graph_path`, `graph_explain`) | Questions généralistes sans scope repo |
| PJ image + décrire / scène | **VISION_ATTACHED** (Ollama) | OCR long document structuré |
| PJ image + **transcrire / extraire texte** + `OCR_SERVICE_URL` | Vision puis **fallback OCR HTTP** si Ollama échoue ; ou tour document si `tool.ocr` actif | — |
| PDF / document + extraire / indexer | **tool.ocr** (`ocr_page`, `ocr_document`) + `ocr-service` | Photo libre sans signal document |
| Code patch / refactor | **behavior.ponytail** | Pédagogie, web shopping |
| Tour technique frugal | **behavior.caveman** (LITE) + `NEXXUS_LOW_TOKEN_MODE` | Specs, présentation, support |

Point d’accroche pipeline : `composeCapabilityContext()` dans `agentPipeline.js` (après intent + `conversationMove`).

---

## 4. Specs produit (repo)

| Sujet | Fichier |
|-------|---------|
| Capability packs (Ponytail, Caveman, Graphify, OCR) | `docs/agents/capability-packs-v1.md` |
| OCR micro-service | `docs/agents/unlimited-ocr-integration-v1.md` |
| OpenAPI OCR | `ocr-service/openapi.yaml` |
| Règles architecture serveur | `server/ARCHITECTURE_RULES.md` |

---

## 5. ADR et gouvernance (vault)

- Index ADR : [[01-Architecture/02-Architecture/adr/Index-ADR]]
- Intégration vault ↔ Nexxus : [[01-Architecture/02-Architecture/vault-integration]]
- Bibliothécaire : [[00-Gouvernance/bibliothecaire]]

Nouvelle décision **architecture agent** → ADR dans `01-Architecture/02-Architecture/adr/` ; entrée courte optionnelle dans `.memory/decisions.md`.

---

## 6. Règles d’usage agents

1. **Structure / impact** → interroger le graphe (`tool.graphify` ou CLI) avant de parcourir le code au hasard.
2. **Décision / contrat / pourquoi** → lire ce vault + `docs/agents/`, pas seulement l’export Graphify.
3. **Code source** → dernier recours, fichiers ciblés par le graphe.
4. **Ne pas** indexer tout le monorepo dans le vault Graphify tant que `server/src/agent` n’est pas validé.
5. **OCR GPU** : point de vérité = smoke `ocr-service/scripts/smoke_ocr_transformers.py` sur `sample-invoice-page.png` avant P1 PDF / SGLang.

---

## 7. Vérifications rapides (≈ 30 min)

1. `pwsh -File server/scripts/refresh-graphify-agent.ps1` → graphe à jour + sync `server/graphify-out/`.
2. `graphify explain ocrVisionFallback` ou requête REPO chat sur le pipeline OCR/vision.
3. Export Obsidian vers `graphify-vault/server-agent/` quand `--obsidian` sera disponible sur ta CLI.
4. Mettre à jour **cette note** si un nouveau pack capability ou service est ajouté.

---

## Liens

- Export carte (externe) : dossier repo `graphify-vault/server-agent/`
- Décisions opérationnelles courtes : repo `.memory/decisions.md`
