# ADR-20260601 : P5 — Élan conversationnel déterministe

## Statut
**Validé** (01/06/2026)

## Contexte

La Citadelle a stabilisé la **gouvernance de la décision** (P2–P4, `ARCHITECTURE_OPTIONS`, fail-closed skill). Elle sait :

- détecter l'intention,
- choisir un contrat,
- bloquer les mauvais chemins,
- éviter la sur-promesse.

Elle ne fait pas encore assez bien trois mouvements conversationnels simples :

1. **Résumer** ce que l'utilisateur veut vraiment (sans LLM lourd).
2. **Choisir un angle utile par défaut** quand plusieurs options existent.
3. **Faire avancer** la conversation d'un pas concret, à faible friction.

Symptôme visible : une réponse `ARCHITECTURE_OPTIONS` conforme au contrat se termine sur **3 options neutres + question ouverte**, sans recommandation ni prochain pas.

**Formule du gap** : La Citadelle sait gouverner la décision, mais pas encore l'élan conversationnel.

## Décision

Introduire **P5 — micro-cognition conversationnelle déterministe** entre le routage et le rendu final :

```
P4 Interprète → Short-circuit / contrat → [P5 Élan] → réponse utilisateur
```

### Doctrine P5

> **P5 commence par imposer un élan conversationnel déterministe, avant toute sophistication LLM.**

Règle opérationnelle :

> Si une réponse propose **plusieurs options**, elle **doit** inclure :
> - une **recommandation explicite par défaut**, et/ou
> - un **prochain pas concret** ;
> idéalement **les deux**.

Fail-closed : si le signal est **vague** → clarification (P4 / framing), **pas** de recommandation inventée.

### Scope v1.0 (ARCHITECTURE_OPTIONS uniquement)

| Brique | Fichier | Rôle |
|--------|---------|------|
| Types | `micro/momentum/conversationMoveTypes.js` | Constantes move / contrat |
| `nextMovePolicy` | `micro/momentum/nextMovePolicy.js` | Table intent × signal → recommend / clarify / advance |
| `defaultRecommendationBuilder` | `micro/momentum/defaultRecommendationBuilder.js` | Recommandation + prochain pas par contrat |
| Orchestrateur | `micro/momentum/conversationMomentumOrchestrator.js` | Applique P5 sans LLM |
| Reply builder | `micro/replies/architectureDesignReplyBuilder.js` | Enrichit la sortie architecture |

### Objet interne (v1 — implicite, non exposé utilisateur)

```javascript
{
  user_goal: null,              // v1.2 — conversationGoalExtractor
  best_next_move: "recommend",
  default_recommendation: "intermediate",
  follow_up_style: "concrete_step"
}
```

### Politique de recommandation (ARCHITECTURE_OPTIONS)

| Signal / mots-clés | Recommandation par défaut |
|--------------------|---------------------------|
| `vague` | Aucune — framing only |
| prototype / MVP / simple | Approche légère |
| échelle / benchmark / usine | Approche industrielle |
| défaut (code-reviewer, agent, RAG…) | **Approche intermédiaire** |

### Ce qui est hors scope v1.0

- `conversationGoalExtractor` avec fallback LLM Granite 8b
- Enrichissement `IDEATION_OPEN` (v1.1)
- Skill `skill-conversation-momentum` (v1.2, promotion terrain)

## Conséquences

### Positives

- Réponses architecture **orientées** : recommandation + prochain pas
- Aucun expert réveillé, aucun LLM requis
- Compatible avec gouvernance existante (fail-closed, local-first)
- Tests smoke étendus (must include recommendation + prochain pas)

### Compromis

- Recommandation heuristique — peut être sous-optimale sur cas atypiques
- v1 limité à `ARCHITECTURE_OPTIONS` — idéation reste neutre jusqu'à v1.1

## Validation

```bash
cd server && node --test tests/conversation-momentum-p5.test.js
cd server && node --test tests/architecture-design-intent.test.js
```

Requête terrain :

> comment créer un code-reviewer qui analyse tout le code d'un projet

Attendu :

- « Je partirais plutôt sur **l'approche intermédiaire**… »
- 3 approches dont l'intermédiaire marquée *(recommandée pour ton cas)*
- « **Prochain pas** : définissons ce qu'un « review senior » doit produire… »
- Pas de question ouverte générique en clôture

## Plan d'extension

| Phase | Scope |
|-------|-------|
| **v1.0** ✅ | ADR + nextMovePolicy + defaultRecommendationBuilder + ARCHITECTURE_OPTIONS |
| **v1.1** | IDEATION_OPEN + smoke registry |
| **v1.2** | conversationGoalExtractor (heuristiques + LLM borné si résidu) |
| **v1.3** | Skill candidat si critères promotion terrain |

## Liens

- [[ADR-20260601-Architecture-Design-Options|Doctrine « comment créer X »]]
- [[ADR-20260601-Micro-Conversation-Delestage|Micro-délestage conversationnel]]
- [[Micro-Conversation-Delestage|Module Micro Conversation]]
- Code : `server/src/agent/micro/momentum/`
