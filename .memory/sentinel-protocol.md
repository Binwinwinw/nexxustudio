# PROTOCOLE SENTINEL-G (Gemini Trace)

## 1. Déclencheur (Trigger)
Tout échec de commande, crash de service, erreur de rendu (écran noir) ou correction demandée par **Binwinwinw** doit activer ce protocole.

## 2. Phase 0 : Arrêt de Production
Interdiction de proposer un correctif immédiat. L'IA doit d'abord entrer en mode "Audit Systémique".

## 3. Phase 1 : Pipeline Trace (Remontée à la source)
L'IA doit répondre aux questions suivantes dans sa phase de réflexion (`<think>`) :
- **Origine** : Quel est le premier point d'entrée de la donnée/variable défaillante ?
- **Flux** : Par quels fichiers/composants cette donnée a-t-elle transité ?
- **Dépendances** : Quels sont les imports ou services tiers impliqués ?
- **Point de Rupture** : Pourquoi la logique a-t-elle échoué à cet endroit précis ?

## 4. Phase 2 : Recalcule Logique (Systemic Pivot)
Au lieu de "réparer le coin", l'IA doit :
- Évaluer si la structure globale doit être modifiée pour empêcher toute récurrence.
- Vérifier les effets de bord sur les autres composants du Studio.
- Proposer une solution qui durcit l'intégralité du pipeline, pas seulement le point de crash.

## 5. Phase 3 : Validation Béton Armé
Chaque correctif doit être vérifié manuellement (grep, ls, build) avant d'être présenté au Concepteur.

## Loi Fondamentale
> *"Une erreur corrigée sans trace de pipeline est une dette technique contractée contre la souveraineté du projet."*
