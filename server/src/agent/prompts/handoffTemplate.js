/* server/src/agent/prompts/handoffTemplate.js */

export const HANDOFF_SCHEMA_VERSION = "1.2";

export const HANDOFF_FORMAT = `
{
  "schemaVersion": "1.2",
  "sessionId": "UUID",
  "projectTitle": "string",
  "projectType": "string",
  "goal": "string",
  "currentState": {
    "summary": "string",
    "status": "DISCOVERY|PLANNING|READY_FOR_FORGE|BLOCKED",
    "completed": ["string"],
    "pending": ["string"],
    "blockers": ["string"]
  },
  "deliverables": [
    {
      "name": "string",
      "desc": "string",
      "status": "planned|drafted|ready"
    }
  ],
  "constraints": ["string"],
  "recommendedStack": ["string"],
  "expertsRequired": ["string"],
  "decisions": [
    {
      "decision": "string",
      "rationale": "string",
      "alternativesRejected": ["string"]
    }
  ],
  "assumptions": ["string"],
  "openQuestions": ["string"],
  "doNotRetry": ["string"],
  "artifacts": [
    {
      "path": "string",
      "role": "string"
    }
  ],
  "confidence": {
    "level": "low|medium|high",
    "reason": "string"
  },
  "nextAction": {
    "owner": "architect|developer|forge",
    "instruction": "string"
  },
  "forgeDirectives": {
    "architect": "instruction",
    "developer": "instruction"
  }
}
`.trim();

export function buildHandoffPrompt() {
  return `
--- DIRECTIVE DE HANDOFF ---

MISSION :
Vous avez atteint un point de transfert vers la Forge.
Votre rôle est de produire un handoff JSON strict, fidèle au contexte réel, exploitable immédiatement par l'agent suivant, sans perte de continuité.

OBJECTIF :
Préserver non seulement la vision du projet, mais aussi l'état courant, les décisions déjà prises, les hypothèses actives, les blocages, les artefacts utiles et la prochaine action concrète.

FORMAT OBLIGATOIRE :
Votre réponse doit contenir un unique bloc JSON encapsulé dans les balises \`<handoff>\` et respectant strictement la structure suivante :

${HANDOFF_FORMAT}

RÈGLES CONTRACTUELLES :
- Ne changez jamais les clés JSON.
- Ne renommez aucun champ.
- Ne supprimez aucun objet obligatoire.
- N'ajoutez aucun champ hors schéma.
- Remplissez les valeurs avec les données réelles du projet courant.
- Si une information manque réellement, utilisez une valeur vide cohérente :
  - chaîne vide : ""
  - liste vide : []
- N'inventez jamais une décision, un fichier, une stack ou un livrable absent du contexte.
- Le handoff doit refléter l'état réel du travail, pas un idéal théorique.

RÈGLES DE CONTENU :
- \`goal\` : vision fonctionnelle du projet en une phrase claire.
- \`currentState.summary\` : état global du projet au moment exact du transfert.
- \`currentState.completed\` : ce qui a déjà été clarifié, défini ou produit.
- \`currentState.pending\` : ce qui reste à faire avant ou pendant la Forge.
- \`currentState.blockers\` : uniquement les blocages réels encore actifs.
- \`deliverables\` : liste explicite des sorties attendues ; chaque élément doit avoir un statut.
- \`constraints\` : contraintes techniques, fonctionnelles, temporelles ou de périmètre.
- \`recommendedStack\` : stack recommandée uniquement si elle ressort du contexte.
- \`expertsRequired\` : rôles réellement nécessaires pour la suite.
- \`decisions\` : inclure uniquement les décisions déjà prises, avec leur rationale.
- \`assumptions\` : hypothèses encore actives et non confirmées.
- \`openQuestions\` : questions réellement ouvertes qui peuvent changer la suite.
- \`doNotRetry\` : éléments à ne pas relancer, reposer ou reconstruire inutilement.
- \`artifacts\` : fichiers, chemins, documents, plans ou ressources déjà disponibles et utiles pour la suite.
- \`confidence\` : niveau de confiance global sur la complétude du handoff.
- \`nextAction\` : première action concrète attendue du prochain agent.
- \`forgeDirectives.architect\` : instruction ciblée pour l'architecte Forge.
- \`forgeDirectives.developer\` : instruction ciblée pour le développeur Forge.

CRITÈRES DE QUALITÉ :
Le handoff doit permettre à un agent receveur de comprendre immédiatement :
1. ce que l'utilisateur veut vraiment,
2. ce qui a déjà été acté,
3. ce qui reste incertain,
4. ce qu'il ne faut pas refaire,
5. quelle est la prochaine action utile.

CONTRAINTE DE SORTIE :
- Ne produisez aucun commentaire hors du bloc \`<handoff>\`.
- Ne produisez aucune explication avant ou après.
- Après le bloc \`<handoff>\`, terminez uniquement par :
[READY]
`.trim();
}