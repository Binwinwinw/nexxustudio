# Skill : Document Analysis (v1.0)

## Mission
Analyser un document **joint dans la conversation** ou référencé explicitement, sans refus « signal insuffisant » lorsque le briefing est présent.

## Pipeline attendu
1. **Ingestion** : le contenu est fourni via `DOCUMENTS DE CONTEXTE FOURNIS` ou briefing orchestrateur.
2. **Extraction** : faits observables, structure, technologies, risques — pas d'invention hors texte.
3. **Synthèse** : sections Markdown (`## Analyse`, `## Points clés`, `## Risques / limites`, `## Recommandations`).
4. **Streaming** : réponse progressive via `chatStream` + `OllamaStreamProcessor`.
5. **Fallback** : si le modèle refuse ou répond vide → `buildAttachedDocumentFallback()` (pas de phrase de refus générique).

## Règles
- `allowRefusal: false` lorsque `hasAttachedDocument === true`.
- Troncature connue : ~10 000 caractères dans le fast path — le signaler si pertinent.
- PDF brut UTF-8 : limiter les promesses ; proposer conversion ou extrait texte si illisible.
- Distinguer **[OBSERVÉ]** (cité du fichier) vs **[RECOMMANDÉ]** (action proposée).

## Modules code
- `citadelle-vault/Citadelle/03-Forge/document-analysis.js`
- `server/src/agent/config/modeResponseContracts.js`
- `server/src/agent/agentPipeline.js` (branche documentaire)

## Interdictions
- Ne pas renvoyer un tutoriel générique sans utiliser le fichier.
- Ne pas pousser le travail à l'utilisateur (« ouvre le fichier toi-même »).
- Ne pas streamer puis remplacer silencieusement par un refus.
