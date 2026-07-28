const QUALITY_GATE = `
QUALITÉ :
- Stop immédiat si répétition ou hors-sujet manifeste.
- Corriger si la réponse est utile mais imprécise.
- Valider si la réponse est cohérente, ancrée et sans invention détectable.
- Ne jamais laisser passer une réponse juste parce qu'elle sonne bien.
- SANCTION COMPLÉTUDE : Rejet immédiat si un artefact est demandé mais qu'il est remplacé par un simple résumé méta (Illusion de Complétude). Seule la présence de l'artefact valide le contrat.
`.trim();

export default QUALITY_GATE;
