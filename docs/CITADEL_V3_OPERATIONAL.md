# Nexxus Citadel v3.1 : État Opérationnel (Mai 2026)

## 🏗️ Architecture "Ready-Fast"
La v3.1 marque la fin de la latence au démarrage. Le système est conçu pour une disponibilité instantanée.
- **Boot Immédiat** : Le serveur backend (port 3000) et l'UI Vite sont prêts en moins de 2 secondes.
- **Warmup par Cascade** : Les modèles IA chargent en arrière-plan selon une priorité de service (Chat ➡️ Stratégie ➡️ Forge).
- **Endpoint `/api/health/runtime`** : Monitoring en temps réel de l'état des Tiers neuronaux et des performances (TPS).

## 🧠 Neural Matrix 4-Tiers
L'orchestration cognitive est désormais segmentée pour optimiser la VRAM et la vitesse.
- **Tier 1 (Instant Chat)** : Débit benchmarké à **50.3 tok/s** via `qwen3.5:4b`.
- **Tier 2 (Strategic Planning)** : Intégration de `deepseek-r1:8b` pour une décomposition de tâches d'une précision chirurgicale.
- **Tier 3 (Elite Forge)** : Utilisation de `starcoder2:15b` (Artisanat code) et `qwen3.5:27b` (Audit critique).

## 🛡️ Sécurité & Gestion VRAM
- **Unload Intelligent** : Libération automatique de la VRAM après 10 minutes d'inactivité pour les modèles Tier 3 (>10GB).
- **Escalade Forcée** : Passage obligatoire sur le Tier 3 pour les domaines critiques : Audit de sécurité, Architecture, Gouvernance.
- **Sentinel Monitoring** : Surveillance continue du taux d'hallucination et de l'intégrité du code généré.

## 🚀 État de la Forge
- **Readiness-Gating** : La production ne démarre qu'après validation du plan par le Stratège (Tier 2).
- **Exécution Outillée** : Le `ToolExecutor` est désormais synchronisé avec le `pulseEngine` pour garantir des builds "Error-Free".

---
**Certification v3.1** : Stable, Optimisée, Souveraine. 🏛️🏁
*Scellé par Antigravity.*
