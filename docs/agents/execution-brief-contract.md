# ExecutionBrief — contrat Zephyr → Ornith (v1.0.0)

Contrat gouverné pour le préprocesseur Zephyr : **JSON structuré uniquement**, pas de meta-prompt narratif systématique.

## Chaîne de vérité

```
Requête brute
  → RequestIntentFrame + intentShortCircuit (déterministe, prioritaire)
  → si trigger match : runSemanticPreProcessing (Zephyr, 2s, fail-open)
  → ExecutionBrief validé (Ajv)
  → injection EXECUTION_BRIEF: {...} dans system prompt Ornith/composer
  → si rigor_level=high : escalade ornith+r1 (séquentiel, pas co-résident)
```

## Fichiers

| Fichier | Rôle |
|---------|------|
| `server/src/agent/contracts/executionBrief.schema.json` | Schéma Ajv |
| `server/config/executionBrief.trigger-matrix.json` | Matrice trigger → actor → template |
| `server/src/agent/policies/executionBriefPolicy.js` | Évaluation triggers, validation, injection |

## Zephyr : quand oui / quand non

| Invoquer Zephyr | Ne pas invoquer |
|-----------------|-----------------|
| Follow-up elliptique | Short-circuit G46/G47/G49 match |
| **Semi-social warm** (« ok et sinon », « t'en penses quoi ») | Social only / gratitude / time |
| Référence contexte | Famille déterministe déjà résolue |
| Question meta-système (archi, modèles, policies) | Famille déterministe déjà résolue |
| Ambiguïté résiduelle medium/high | Requête < 5 caractères |
| Critique comportement assistant | |

## Matrice trigger (résumé)

| ID | intent_family | actor | rigor | template |
|----|---------------|-------|-------|----------|
| TRG_WARM_TONE_SEMI_SOCIAL | warm_tone_semi_social | ornith | low | TEMPLATE_WARM_TONE |
| TRG_FOLLOW_UP_ELLIPSIS | follow_up | ornith | low | TEMPLATE_FOLLOW_UP_RESOLVE |
| TRG_META_SYSTEM_ARCH | meta_system | ornith+r1 | high | TEMPLATE_META_SYSTEM_ARCH |
| TRG_META_ASSISTANT_BEHAVIOR | meta_assistant_behavior | ornith | medium | TEMPLATE_ASSISTANT_BEHAVIOR |
| TRG_AMBIGUOUS_RESIDUAL | ambiguous | clarify_then_ornith | medium | TEMPLATE_AMBIGUOUS_CLARIFY |
| TRG_EXPLAIN_STRUCTURED | general_explain | ornith | medium | TEMPLATE_EXPLAIN_STRUCTURED |
| TRG_CODE_HANDOFF | code | expert_lazy_code | medium | TEMPLATE_CODE_HANDOFF |

## Injection composer (exemple)

```
EXECUTION_BRIEF: {"v":"1.0.0","q":"...","family":"meta_system","rigor":"high","actor":"ornith+r1",...} | HINT: Question système : livrable policy_recommendation...
```

## Tests

```bash
node --test server/tests/execution-brief-policy.test.js
node --test server/tests/warm-tone-semi-social.test.js
```

## Wiring pipeline (actif)

- `server/src/agent/stages/executionBriefStage.js` — stage fail-open
- `server/src/agent/agentPipeline.js` — avant `finalRendererAgent.compose`
- `server/src/agent/config/modeResponseContracts.js` — injection `EXECUTION_BRIEF` dans system prompt

Désactivation : `EXECUTION_BRIEF_ENABLED=0` · Zephyr off : `EXECUTION_BRIEF_ZEPHYR=0` (brief heuristique seul).

---

## Doctrine « humanity probe » (v1)

**Principe** : sonder les LLM comme un stéthoscope, pas comme une usine. Le petit LLM **éclaire** (cadre JSON), il ne **envahit** pas (pas de meta-prompt narratif, pas de chaîne agentique systématique).

### Trois paliers

| Palier | Nom | Mécanisme | Latence cible |
|--------|-----|-----------|---------------|
| **T0** | Déterministe pur | Short-circuit / templates / pas de composer | < 100 ms |
| **T1** | Humanity probe | ExecutionBrief (+ Zephyr 2s opt.) → Ornith compose | < 3 s TTFT |
| **T2** | Rigueur exceptionnelle | Brief `rigor=high` → R1 séquentiel ou expert lazy | session isolée |

Ornith reste le **visage conversationnel**. R1 reste **exceptionnel**.

### T0 — 100 % déterministe (jamais de humanity probe)

Ces tours **ne passent pas** par `resolveExecutionBriefStage` (skip ou réponse avant composer) :

| Catégorie | Exemples | Rails existants |
|-----------|----------|-----------------|
| Social court | « salut », « merci », « ça va ? » | `social_deterministic`, `acknowledgment_deterministic` |
| Temps / date | « quelle heure », « quel jour » | `datetime_deterministic`, semantic resolver assist |
| Familiarité simple | « tu connais X ? » (entité connue) | `familiarity_deterministic` |
| Maths élémentaires | racine, géométrie, pourcentage | `math_*_deterministic` |
| Rails G46/G47/G49 | pronostics, jeux, peer assistants | short-circuit déterministe |
| Familles pédagogiques résolues | learning path, overview local | reply locale + tests CI |
| Gratitude / clôture | « ok top », « merci beaucoup » | skip `gratitude_closure` |

**Règle** : si le tour est **évident, social, déjà résolu ou testé en CI**, T0 suffit — ajouter un probe dégraderait le naturel (latence + variabilité).

### T1 — Humanity probe (ExecutionBrief léger)

Zephyr **peut** compléter le cadre ; Ornith **répond** avec ton mentor/direct :

| Catégorie | Pourquoi un probe | Trigger | Ce que le probe apporte |
|-----------|-------------------|---------|-------------------------|
| **Semi-social warm** | « ok et sinon », « t'en penses quoi » | `TRG_WARM_TONE_SEMI_SOCIAL` | rebond complice, pas de surclarification |
| Follow-up elliptique | « et le poker ? » sans contexte explicite | `TRG_FOLLOW_UP_ELLIPSIS` | `canonical_query` autonome + ton direct |
| Référence session | « tu te rappelles de… » | idem / context ref | sujet restauré, pas de refus sec |
| Critique comportement | « tu ne réfléchis pas » | `TRG_META_ASSISTANT_BEHAVIOR` | rail expliqué, correctif en 3 étapes |
| Ambiguïté résiduelle | intent flou après frame | `TRG_AMBIGUOUS_RESIDUAL` | clarification OU hypothèse explicite |
| Explain non routé | concept technique sans rail dédié | `TRG_EXPLAIN_STRUCTURED` | structure courte, pas procédure vide |

**Ce que le probe ne fait pas** : rédiger la réponse finale, inventer la personnalité en prose, déclencher l'orchestrateur lourd.

### T2 — Rigueur exceptionnelle (pas un humanity probe)

| Catégorie | Trigger | Actor |
|-----------|---------|-------|
| Méta-architecture système | `TRG_META_SYSTEM_ARCH` | `ornith+r1` (à câbler) |
| Forge / code lourd | `TRG_CODE_HANDOFF` | `expert_lazy_code` |

**Barrière coût 8 Go VRAM** : jamais R1 + ornith + vision co-résidents.

### Arbre de décision opérationnel

```
Requête
  ├─ short-circuit T0 match ? → réponse déterministe (FIN)
  ├─ social / time / gratitude / < 5 chars ? → skip probe (FIN ou chemin T0)
  ├─ follow-up / ambigu / meta-assistant ? → T1 humanity probe → Ornith
  └─ meta_system / rigor=high ? → T1 brief + escalade T2 si validé (futur)
```

### Prochaines extensions possibles (sans élargir le périmètre)

1. ~~**Template `TEMPLATE_WARM_TONE`**~~ — livré (v1.0.0).
2. **Probe ciblé sur `_runSimpleFastPath` miss** — uniquement si SIMPLE_FAST renvoie vide et relance elliptique.

### Métriques à surveiller en prod

- `execution_brief_trigger_id` — ratio T1 / total tours
- `execution_brief_latency_ms` — doit rester < 2500 ms p95
- `execution_brief_fail_open` — acceptable si brief heuristique suffit
- Taux de tours T0 social < 100 ms — ne doit pas baisser après activation probe
