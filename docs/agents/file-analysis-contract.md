# FILE_ANALYSIS_V1 — doctrine d’analyse de fichier

**Nature** : contrat de sortie + profondeur. Pas un nouveau rail, pas un nouveau mode.

**Admission fichier** : [`FILE_CAPABILITY_V1`](../governance/file-capability-policy.md) — ce contrat ne décide pas l’entrée.

**Tâche PJ** : `doc_analyze` (inchangée).  
**Contrat de restitution** : `FILE_ANALYSIS_V1`.  
**Analyseur read-only** : `SOURCE_FILE_ANALYSIS_V1` (enveloppe interne).

---

## Point exact du pipeline

```
classifyAttachmentTask          → doc_analyze + fileAnalysisDepth
classifyCodeIntent              → null si FILE_ANALYSIS (pas code_review)
resolveWantsAnalysisFromTriage  → true si PJ + FILE_ANALYSIS
shouldBypassDocumentAnalysisRoute → false (reste sur DOCUMENT)
agentPipeline rail DOCUMENT
  ├─ HTML simple     → réponse ancrée existante
  ├─ HTML complète/critique → trame FILE_ANALYSIS sur les vues HTML
  ├─ .js .py .php .json .md … → analyzeSourceFileContent + formatFileAnalysisReply
  ├─ .sql            → SQL_SOURCE_ANALYSIS_V1 (inventaire déterministe) + trame FILE_ANALYSIS
  └─ PDF             → rail extractif DOCUMENT ; addon de prompt si complète/critique
```

Sovereign / `code_review` / `security_audit` ne sont **pas** ce contrat.

---

## Invariants

- Citer le fichier. S’y ancrer.
- Décrire ce qui est **visible**.
- Interdit : réponse générique sans usage du fichier.
- Ne pas inventer l’invisible.
- Distinguer fait / interprétation / hypothèse / limite.
- Contexte manquant → section « points à vérifier », pas un refus vague.
- Trop court / vide interdit si des artefacts ont été extraits.
- Critique sans faits observables : refus.

La profondeur vient de **l’intention**, pas de l’extension.

| Intention | Profondeur | Sortie |
|-----------|------------|--------|
| « analyse ce fichier », « c’est quoi » | `simple` | identifier, rôle, structure, remarques |
| « analyse complète / détaillée », « découpe » | `complete` | trame 8 sections, critique mesurée |
| « analyse critique / complexe », « faiblesses » | `critique` | trame + diagnostic + risques + priorités + non-vérifiable |

`simple` → décrire.  
`complete` → décrire + structurer.  
`critique` → décrire + structurer + juger + prioriser.

---

## Trame minimale (niveaux 2 et 3)

1. Identification du fichier  
2. Structure interne  
3. Fonctionnement observable  
4. Points positifs  
5. Faiblesses / anomalies  
6. Risques  
7. Points à vérifier  
8. Priorités  

Mutualisable : `.js` `.html` `.py` `.php` `.json` `.md` `.pdf` (PDF = même trame, extraction documentaire ; pas d’audit code).

---

## Différences de contrats

| Contrat | Quand | Sortie |
|---------|--------|--------|
| **FILE_ANALYSIS** | PJ + analyser / expliquer / critique du fichier | Lecture ancrée, profondeur selon l’intention |
| **doc_analyze** | Tâche PJ (contenant) | Route DOCUMENT ; FILE_ANALYSIS en est la doctrine de sortie |
| **code_review** | revue / inspecte / erreurs bloquantes | Erreurs d’exécution, correctif éventuel |
| **security_audit** | audit sécurité, faille, XSS… | Surface d’attaque, findings sécu |
| **code_fix** | corrige / répare | Patch, pas une analyse |

« Analyser le fichier » ≠ revue de code. L’extension `.js` ne décide pas seule.

---

## Exemple — `server-index-clean.js`

Demande : « analyse complète / critique du fichier ».

| Section | Contenu type |
|---------|----------------|
| Identification | Point d’entrée serveur / API HTTP (Express). |
| Structure | Imports, boot, middleware, routes stream/chat, listen. |
| Fonctionnement | API locale de pilotage et de streaming. |
| Points forts | Découpage handlers, flux async si présent. |
| Faiblesses | Robustesse partielle, CORS ouvert si `*` visible. |
| Risques | Exposition locale, auth non visible dans ce fichier. |
| Vérifications | Runtime, fichiers liés, ACL réelle. |
| Priorités | Validité des blocs cités, garde d’accès, validation d’entrées. |

Ce n’est **pas** un audit OWASP, et **pas** un résumé d’une ligne.

---

## SQL — `SQL_SOURCE_ANALYSIS_V1`

`.sql` + analyser → même intercept que `.js`. Inventaire déterministe (tables, colonnes, PK/FK explicites, INSERT, limites).  
Nom de colonne ≠ FK. Nom de table ≠ rôle métier. `documentAnalysis` n'est pas la source.

## PDF partiel (`analysisStatus = partial`)

PDF accepté mais trop long (`PDF_TOO_MANY_PAGES`) ou OCR requis **non exécuté** : même rail `DOCUMENT`, sortie déterministe FILE_ANALYSIS. Distinguer `extracted_from_attachment` / non vérifié / capacité non exécutée.  
`vision_eligible` et `document_analysis_fallback` ne sont pas des étapes faites. Un PDF texte native court reste sur le composeur documentaire actuel.

## Preuve

- `server/src/agent/policies/attachment/fileAnalysisContract.js`
- `server/src/agent/analysis/analyzers/sqlAnalyzer.js`
- `server/tests/file-analysis-contract.test.js`
- `server/tests/sql-source-analysis.test.js`
- `server/tests/attachment-task-policy.test.js`
- `server/tests/pdf-partial-analysis.test.js`
