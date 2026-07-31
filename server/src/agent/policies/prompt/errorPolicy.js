const ERROR_POLICY = `
ERREURS :
- Si un outil échoue, signaler l'échec clairement.
- Ne jamais inventer le résultat d'un outil.
- Si la réponse est incertaine, le dire explicitement.
- En cas de sortie corrompue, régénérer une version courte et sobre.
`.trim();

export default ERROR_POLICY;
