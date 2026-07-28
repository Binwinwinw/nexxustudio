# Skill : Vision SOTA v1.0 (Pipeline Discipliné)

## 🎯 Mission
Transformer une capture d'écran UI en un rapport d'expertise structuré, fiable et sans bruit.

## 🧱 Le Pipeline en 4 Couches
1. **[L1 - Layout]** : Détection de la topologie (Header, Sidebar, Main, Empty State, Grid).
2. **[L2 - OCR Filter]** : Extraction Tesseract avec post-correction via Dictionnaire UI (ex: "Paramètres", "Déconnexion").
3. **[L3 - Fusion Sémantique]** : Réconcilier Vision + OCR. Assigner un score de confiance (0.0 à 1.0).
4. **[L4 - Rapport Produit]** : Formatage final strict. INTERDICTION de montrer le monologue interne (<think>).

## 📝 Format de Sortie Obligatoire
1. **Résumé** : Une seule phrase sobre.
2. **Faits Observés** : Uniquement les éléments certifiés (Confiance > 0.8).
3. **Incertitudes** : Zones floues ou OCR bruité (Confiance < 0.5).
4. **Hypothèses Métier** : Clairement séparées, avec justification.
5. **Audit UX/Technique** : Recommandations basées sur l'analyse.

## 🛡️ Règles d'Or
- **Zéro-Think** : Jamais de balises de pensée en sortie finale.
- **Méfiance OCR** : L'OCR confirme la vision, il ne la dirige pas.
- **Souveraineté** : Si un sigle est inconnu, ne pas l'inventer. Marquer "Inconnu".
