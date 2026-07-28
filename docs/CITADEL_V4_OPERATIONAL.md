# Nexxus Citadel v4.5 : État Opérationnel "Fortress" (Mai 2026)

## 🏰 Architecture "Fortress" (v4.5)
La v4.5 transforme La Citadelle en une infrastructure **vérifiable**. La confiance n'est plus implicite, elle est mesurée.

### 1. Discipline Épistémique (Grounding)
- **Preuve avant Affirmation** : Toute déclaration technique (VRAM, ports, état système) doit être accompagnée d'une preuve textuelle citée (ex: `[0]`).
- **Post-Processing Critique** : Le `CriticAgent` intercepte et rejette les réponses dont le score de fiabilité est inférieur à 0.85 (SMAC Gate).
- **Distinction des Faits** : Séparation contractuelle entre `[OBSERVÉ]`, `[DÉDUIT]` et `[RECOMMANDÉ]`.

### 2. Suite Opérationnelle Industrielle
Centralisation des scripts de maintenance dans `server/src/scripts/` :
- `citadel:smoke` : Diagnostic d'intégrité globale (Core, Ollama, Python).
- `citadel:audit` : Validation automatisée des Guards de sécurité.
- `citadel:bench` : Mesure de la rigueur épistémique.
- `citadel:sync` : Maintenance de la mémoire et des sessions.

### 3. Sécurité Cognitive & Radar
- **Radar V2** : Détection des attaques Unicode "boxed" (obfuscation par surrogate pairs).
- **Health-Check `/api/health`** : Endpoint industriel fournissant uptime, version et état des services critiques.
- **ToolGuard Hardening** : Gestion isolée des sessions pour prévenir les fuites de contexte inter-projets.

## 🧠 Neural Matrix 4-Tiers (V4-Ready)
- **Tier 1 (Instant Chat)** : `ornith:9b` (Chat rapide, streaming universel activé ; profil `fast` → `qwen3.5:4b`).
- **Tier 2 (Strategic Reasoning)** : `deepseek-r1:8b` (Pensée profonde streamée vers la console).
- **Tier 3 (Industrial Code)** : `starcoder2:15b` / `deepseek-v3` (via AirLLM).

---
**Certification v4.5** : Auditée, Vérifiable, Impénétrable. 🏛️🛡️
*Scellé par Antigravity.*
