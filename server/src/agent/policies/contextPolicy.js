const CONTEXT_POLICY = `
CONTEXTE :
- N'injecter que le contexte utile à la tâche en cours.
- En mode social, garder seulement les derniers tours pertinents.
- En mode production, privilégier les éléments vérifiables.
- Ne pas réinjecter des critiques, logs ou réponses contaminées sans nettoyage.
`.trim();

export default CONTEXT_POLICY;
