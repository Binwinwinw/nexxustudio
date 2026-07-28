/**
 * Consignes méta-analyse — interprétation argumentative, pas extraction.
 */
export const ANALYTICAL_CRITIQUE_RULE = "interpret_argument_not_extract";

export function getAnalyticalCritiqueSystemHint() {
  return `Mode MÉTA-ANALYSE ARGUMENTATIVE (${ANALYTICAL_CRITIQUE_RULE}):
- INTERDIT : "Points clés extraits", liste extractive, reformulation section par section sans jugement.
- OBLIGATOIRE — structure markdown courte :
  ## Objet de la demande (1 phrase)
  ## Lecture (ce que le texte démontre vraiment, pas ce qu'il répète)
  ## Niveaux (code | runtime/process | comportement UI)
  ## Preuves / Probable / Ambigu (3 puces max chacun)
  ## Chaîne causale centrale (si applicable)
  ## Conclusion (1–2 phrases, diagnostic nouveau)
- Relier les contradictions (ex. dépôt corrigé vs sortie ancienne → hypothèse process/instance).
- Ne pas répéter les consignes opérationnelles (npm run start) sauf si c'est le cœur de la question.`;
}

/**
 * Squelette déterministe minimal si le LLM échoue (fail-closed utile).
 */
export function buildAnalyticalCritiqueFallback(query = "") {
  const mentionsRuntime =
    /\b(runtime|nodemon|process|instance|recharg|grep|template|ancien)\b/i.test(query);
  const mentionsPatch = /\b(patch|dépôt|depot|tests? passent|capability_gaps)\b/i.test(query);

  return `## Objet de la demande
Tu ne demandes pas un résumé du texte collé, mais une **validation argumentative** : le diagnostic tient-il, et où est la cause la plus probable ?

## Lecture
Le texte établit surtout un **décalage code ↔ runtime** : le dépôt et les tests décrivent un comportement corrigé, alors que l'UI montre encore l'ancien template. Ce n'est pas un échec de conception du patch, c'est une preuve de non-alignement d'exécution.

## Niveaux
- **Code** : sous-intents méta + forge_status présents (si tests OK).
- **Runtime** : process Node / nodemon possiblement pas rechargé — **cause probable**.
- **UI** : symptôme (même réponse, refus forge) — conséquence, pas cause racine.

## Preuves / Probable / Ambigu
- **Prouvé** : texte affiché ≠ texte attendu du dépôt actuel.
- **Probable** : ${mentionsRuntime ? "instance ancienne ou watch incomplet" : "déploiement non synchronisé"}.
- **Ambigu** : ${mentionsPatch ? "quel build exact tourne (hash/log pipeline)" : "environnement de lancement"}.

## Chaîne causale centrale
Patch en dépôt → tests locaux OK → **mais** sortie utilisateur = ancien chemin → hypothèse forte : **mauvais process servi**, pas mauvaise règle méta.

## Conclusion
La Citadelle a **extrait** ton analyse au lieu de l'**interpréter** — il faut un intent « méta-analyse critique », distinct de Document Analysis extractif.`;
}
