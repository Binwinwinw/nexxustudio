# 🛡️ Spécification : Cockpit de Gouvernance v3.1

## 1. Vision & Architecture

Le Cockpit v3.1 est l'interface de supervision souveraine de La Citadelle. Il repose sur une architecture découplée pour garantir la réactivité et la testabilité du système.

- **Moteur (Logic)** : Hook `useCockpitTelemetry` (Fetch 3s, Timeout 2.5s, Ticker de fraîcheur 1s).
- **Interface (UI)** : Grille Bento adaptative, design "Industrial High-Contrast".
- **Accessibilité** : Polices ≥ 12px, WCAG ratios 4.5:1, support `prefers-reduced-motion`.

## 2. Matrice d'Intervention

- Le pilotage est structuré par trois niveaux de priorités liés au [[02-Architecture/modules/CGTM-SOEM|Noyau de Gouvernance]] :
- 🔴 **[URGENT]** : Risques critiques (VRAM, Sécurité). Action immédiate via le [[05-Knowledge/heritage/Composants-Souverains|Sovereign Sentinel]].
- 🟡 **[CONSEILLÉ]** : Dérives de performance (Latence, Tokens). Optimisation différée.
- 🔵 **[STRATÉGIQUE]** : Jalons de maturité ([[03-Forge/v4.5-Industrialisation-Protocoles|Forge Ready]]). Validation humaine souveraine.

## 3. États de Sûreté

- **Normal** : Système opérationnel, données fraîches.
- **Stale** : Perte de liaison backend (> 7s). Filtre grayscale et indicateur d'obsolescence.
- **Error** : Panne API signalée par badge d'alerte rouge.

## 4. Certification (Tour de Contrôle)

Le module est certifié par le script `validate_cockpit_v3_1.js` assurant la conformité des flux de télémétrie.

---

### 📚 Références & Fondations

- [[Index-ADR|🗺️ Atlas des Décisions d'Architecture]] (ADRs)
- [[ADR-008.1-Manifest-v3.1|📜 Manifeste de Configuration v3.1]]

---

Document scellé le 07/05/2026 - Citadelle v3.1*
