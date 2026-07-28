# Changelog — familles d'intent et IntentFrame

Historique des lots, batteries numérotées et notes de version.
**Ne fait pas foi** pour la doctrine — voir [intent-families-doctrine.md](intent-families-doctrine.md).

## Versions alignées

- `INTENT_FAMILY_REGISTRY_V1`
- `TECHNICAL_LEARNING_BLUEPRINTS_V1`
- `REQUEST_INTENT_FRAME_V1.1`
- `SESSION_CONTEXT_REFERENCE_V1`
- `REQUEST_DECOMPOSITION_V1.2.1`
- Patrons transverses #34, #34b, #35, #36, #37, #38a (juillet 2026)

## Index des batteries

| # | Domaine | Fichier test |
|---|---------|--------------|
| #1–#23 | IntentFrame ambiguïté | `intent-frame-ambiguity-battery.test.js` |
| #15–#18 | Info-seeking (tigre, Taj Mahal, kimono) | batterie info-seeking |
| #19 | Traduction vs social | `translation-intent-guards.test.js` |
| #20 | Traduction dérivée FR→ES→DE | `translation-intent-guards.test.js` / context ref |
| #21–#23 | Context reference | `context-reference-resolution.test.js` |
| #24 | Multi-unit smoothie+heure+date | `request-decomposition-policy.test.js` |
| #25 | How-to qualification | `how-to-qualification-policy.test.js` |
| #26 | Pending clarification resume | `pending-clarification-resume.test.js` |
| #34 | Familiarity domain overview | `familiarity-domain-overview-policy.test.js` |
| #34b | Subject reference resume | `subject-reference-resume-policy.test.js` |
| #36 | Weather current request | `weather-current-request-policy.test.js` |
| #37 | Prompt for artifact | `prompt-for-artifact-policy.test.js` |
| #35 | Pedagogy soft overview | `pedagogy-soft-overview-policy.test.js` |
| #38a | Traffic current request | `traffic-current-request-policy.test.js` |

## Journal des lots (sélection)

| Lot | Tag | Résumé |
|-----|-----|--------|
| v1.1.2 | info-seeking | Shells possession d'information ; shadow `[INTENT_FRAME]` |
| v1.1.3 | info-seeking orch | Matrice `[INFO_SEEK_ORCH]` |
| v1.1.4–v1.1.5 | translation | Shell primaire, preempt social |
| v1.1.6 | context_ref | `[CONTEXT_REF]`, resolver session |
| v1.1.7 | translation | Multi-cible batch |
| v1.2 | decomposition | `[REQUEST_DECOMP]`, multi_unit |
| v1.2.1 | inventory | Inventaire multi-signaux, satisfiable → déterministe |
| v1.2.2 | pending clarify | Reprise clarification how-to |
| #34 | familiarity | Domain overview déterministe |
| #34b | subject_ref | Nouveau sujet vs reprise session ; garde session vierge |
| #36 | weather | `current_web_fact`, web SERP, fallback honnête |
| #37 | prompt_for_artifact | Prompt opératoire copiable ; frontière explain / html_project |
| #35 | pedagogy_soft_overview | Aperçu vague histoire/géo/sciences ; répondre d'abord |
| #38a | traffic current | Extension current_web_fact — trafic routier temps réel |
| #38c | rate current | *(planifié)* taux de change / directeur |
| #38b | schedule current | *(planifié)* horaires du jour |

## Détail batteries contexte (#20–#23)

| # | Requête | Attendu |
|---|---------|---------|
| 20 | « la phrase précédente mais en allemand » (après FR→ES) | `translation_pipeline` |
| 21 | « tu te rappelles de kingofavalon » | `information_seeking_full_pipeline` |
| 22 | « tu te rappelles de Docker » (absent) | `context_reference_not_found` |
| 23 | « reprends ce qu'on disait sur le kimono » | `information_seeking_full_pipeline` |
