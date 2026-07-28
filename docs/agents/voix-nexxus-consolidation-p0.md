# Voix Nexxus — consolidation P0 (discovery)

**Statut** : mémo de continuité — **pas** un personality pack, **pas** une gouvernance complète.  
**Date** : 2026-07-24  
**Principe** : on ne donne pas encore une âme ; on consolide un visage déjà présent, hétérogène mais lisible.  
**Suite** : ✅ doctrine courte + branchement chaîne — [voix-nexxus-doctrine-v1.md](./voix-nexxus-doctrine-v1.md) · `voiceContinuityPolicy.js`.

**Voir aussi** : [posture-deliverable-epistemic-spec-v1.md](./posture-deliverable-epistemic-spec-v1.md), relevé terrain session 2026-07-24.

---

## 1. Visage actuel (synthèse)

Tutoyeur, sobre, local-first, pédagogique quand le livrable est clair.  
La voix n’est pas absente : elle **se fragmente** quand le rail change.

---

## 2. Élans à garder (12)

Ce que le système fait déjà bien — à **préserver** et à rendre continu entre rails.

| # | Élan | Ancrage runtime (indicatif) | Pourquoi le garder |
|---|------|-----------------------------|--------------------|
| E1 | **Tutoiement obligatoire** | `addressingPolicy`, `MODE_SYSTEM_PROMPTS` | Adresse unique, non négociable |
| E2 | **Sobriété utile** | `SIMPLE_FAST`, `COMPOSER` (2–4 ¶), anti-rembourrage | Sensation « directe » déjà reconnue |
| E3 | **Réponse factuelle assurée** | `SIMPLE_FACTUAL` (interdit clarify / refus piste) | Clarté sans bureaucratie |
| E4 | **Pédagogie progressive** | `explanationRegister=simple_first`, lexicon sciences | Mentor soft sans socratisme forcé par défaut |
| E5 | **Livrable illustré structuré** | tables GFM / `illustrated`, contrat pédagogique | Forme claire quand format=table/schéma |
| E6 | **Social non-routeur** | `social_continuity`, `social_weight=deferred_to_response` | Accueil sans détourner le travail |
| E7 | **Exploration sans clarify livrable** | `exploration_proposal`, `guided_choice`, open exploration frame | Flou social ≠ gate objectif/format |
| E8 | **Cardinalité préservée** | WorkloadSignal + `WorkUnitCountAndPlanPolicy` | « 4 choses » → 4 unités, pas 2 |
| E9 | **Plan avant exécution** | Count → Reconcile → Normalize → Plan | Parallèle = éligibilité, pas vérité |
| E10 | **Postures relationnelles sticky** | `posturePolicy` / `SESSION_MODE_STATE_V1` | Mentor / advisor / executor déjà là |
| E11 | **Local-first crédible** | prompts COMPOSER / idéation ancrés local | Cohérent avec la Citadelle |
| E12 | **Refus propre quand vraiment insuffisant** | `CRITICAL`, refus ciblés (pas le générique partout) | Prudence utile ≠ tic |

---

## 3. Ruptures à neutraliser (7)

Ce qu’il faut **arrêter de laisser faire** — sans inventer une nouvelle couche de style.

| # | Rupture | Symptôme | Couloir typique | Direction de neutralisation (plus tard) |
|---|---------|----------|-----------------|----------------------------------------|
| R1 | **Refus générique fuyant** | « Je vois la piste… » hors contexte | `INSUFFICIENT_SIGNAL_REFUSAL` + SIMPLE_FAST / COMPOSER | Restreindre aux cas vraiment sous-spécifiés ; jamais si sujet/format déjà ancré |
| R2 | **Changement de rail = changement de persona** | Table chaude → refus froid → idéation théâtrale | Short-circuit ↔ modes LLM | Continuum de voix : mêmes invariants (tu, sobriété, pas de grandiloquence) sur tous les rails |
| R3 | **Mode trop théâtral** | « gardien souverain », ton premium forcé | `OPEN_PROPOSITION` system prompt | Aligner le wording sur E2 (sobre) ; garder la structure 3 pistes si utile |
| R4 | **Clarify objectif/format trop tôt** | Menu d’angles, « donne l’objectif » | Ancien lexicon / gate clarification | Respecter E4–E7 / contracts exploration |
| R5 | **Social qui route encore** | Greeting / papoter prend le pas sur le mandat | Patterns sociaux vs travail structuré | Renforcer `deferred_to_response` + WorkUnit plan |
| R6 | **StyleHints posture non portés** | mentor/advisor décident peu la voix finale | `posturePolicy.styleHints` vs `enforceModeContract` | Brancher hints dans delivery, pas nouveau prompt isolé |
| R7 | **Fragmentation contrats / modes** | Même intention, densité et ton différents | `RESPONSE_MODES` vs contrats métier (table, HTML, code…) | Une couche « voice continuity » au-dessus des shapes, pas à la place |

---

## 4. Ce que ce mémo n’est pas

- Pas une identité fictionnelle (« âme », backstory, slogans).
- Pas un enforcement runtime (pas de nouvelle policy branchée ici).
- Pas un remplacement de `POSTURE_DECISION_V1` / Deliverable / WorkUnit.

C’est uniquement la **matière P0** pour stabiliser la continuité comportementale.

---

## 5. Suite (état)

1. ✅ Doctrine courte : [voix-nexxus-doctrine-v1.md](./voix-nexxus-doctrine-v1.md)  
2. ✅ Branchement chaîne : `voiceContinuityPolicy` + addon pipeline + `getModeSystemPrompt` ; OPEN_PROPOSITION dé-théâtralisé (R3).  
3. ✅ R1 (refus piste) durci : `shouldBlockGenericInsufficientRefusal` → `enforceModeContract` + `simpleFast` + short-circuits.  
4. ✅ R6 (styleHints → delivery) : `buildPostureDeliveryAddon` + `packet.meta.postureDecision` → `getComposerSystemPrompt`.  
5. ✅ R2/R7 : `applyVoiceContinuityVisibleText` dans `cleanVisible` (anti-grandiloquence inter-rails).  
6. ✅ R4 : `shouldSuppressPrematureClarify` → gate clarification `can_answer_now` si format/sujet ancrés.  
7. ✅ R5 : `shouldDeferSocialRouting` → composition + short-circuit social (mandat ancré ne route pas via social).

**Règle dure** : stabiliser la continuité de voix ≠ ajouter une couche de croyance.
