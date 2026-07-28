# ADR-20260723 : Output Shape Critic (G50) v1

## Statut

**Accepté — doctrine** (23/07/2026). Implémentation : observe-first (backlog P0).

## Contexte

La Citadelle route déjà les familles de tâche (G29, attachmentTask, DeliverableContract).  
Les réponses techniques (audit sécu PJ, revue code) souffrent encore d’un **amalgame contenu / preuve / rendu** : le LLM décide seul d’injecter du code mal formé ou inutile.

On dispose de `promisedValue` / `replyShape` conversationnels, pas encore d’arbitre de **forme de preuve**.

## Décision

1. Doctrine : *Le LLM produit le fond sous contrainte ; il n’arbitre pas le mode d’affichage.*
2. Introduire **G50 Output Shape Critic** avec formes : `prose_only` | `table` | `code_snippet` | `no_snippet` | `action_block`.
3. Placer le critic **après** DeliverableContract, **avant** renderer ; mode **observe** puis enforce soft.
4. Ne pas confondre avec l’exécution sandboxée (consentement UI — hors v1).

## Conséquences

- Spec opérationnelle : `docs/agents/output-shape-critic-g50-spec.md`
- Étend le contrat de sortie sans explosion de rails
- Compatible soft-guard PJ (`overrideLocked` / append_only)
- Prépare un renderer honnête (fences, tables) sans laisser le LLM piloter l’UI

## Alternatives rejetées

| Alternative | Pourquoi non |
|-------------|--------------|
| « Toujours afficher le code » | Bruit, amalgames, faux sentiment de preuve |
| Exécution auto des snippets | Risque sécu ; hors souveraineté sans consentement |
| Second critique EPISTEMIC lourd | Sur-réflexion ; G50 doit rester léger et déterministe |

## Suite

P0 : `outputShapeCriticPolicy.js` + télémétrie `[PIPELINE] output_shape=…`  
P0.1 : détection amalgames  
P1 : bornage composer / finalRenderer
