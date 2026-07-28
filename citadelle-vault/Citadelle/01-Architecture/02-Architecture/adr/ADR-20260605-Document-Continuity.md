# ADR-20260605 : Continuité documentaire de fil

**Date** : 05/06/2026  
**Statut** : ✅ Validé — implémenté  
**Règle** : `active_document_inherits_on_followup`  
**Formule** : *analyse documentaire réussie → document actif → follow-up réinjecté → pas de refus si le contexte existe déjà*

## Contexte

Le pipeline Document Analysis traitait correctement le **tour 1** (fichier joint, ex. `mon_css.css`) mais le **tour 2** (« proposer des améliorations », « montre le bloc concerné ») repartait comme une requête nue : pas de pièce jointe, pas de `needsDocumentAnalysis`, court-circuit **SIMPLE_FAST** ou refus épistémique générique.

Ce n’était pas un défaut d’ingestion du fichier, mais une **absence d’état de fil document-centric** réinjecté au tour suivant — en contradiction avec la doctrine de continuité locale (ne pas traiter chaque message comme un événement isolé).

Complémentaire à :

- [[02-Architecture/adr/ADR-004-Continuity-Protocol|ADR-004 — Continuity Protocol]] (reprise longue génération / checkpoint)
- [[02-Architecture/adr/ADR-20260601-Memoire-Fil|ADR-20260601 — Mémoire de fil]] (transcript session, rappel)
- [[02-Architecture/adr/ADR-20260601-Micro-Conversation-Delestage|Micro-délestage conversationnel]] (`conversation_continuity_deterministic`)

## Décision

Après une **analyse documentaire réussie**, les requêtes de suivi orientées amélioration, correction, explication ou exemple **héritent du document actif** tant que le fil n’a pas explicitement changé (nouveau fichier, « oublie le document », nouveau sujet).

### Règle canonique

> Si le tour précédent a produit une analyse sur un document actif **et** que le message courant contient des marqueurs de suivi documentaire, le pipeline **réutilise** briefing + synthèse précédente au lieu d’exiger à nouveau une pièce jointe ou une preuve externe.

### Ordre pipeline (non négociable)

Le reroutage `document_analysis_followup` s’exécute **avant** :

- méta-analyse argumentative ;
- micro-délestage / short-circuit ;
- **SIMPLE_FAST**.

Sinon le bon chemin est court-circuité trop tôt (cf. [[02-Architecture/adr/ADR-20260604-Auto-Reply-Sufficiency|suffisance des auto-réponses]] — autre axe, même principe : ne pas clôturer sur un signal incomplet).

```text
requête + history + sessionId
  → resolveDocumentContinuity
  → shouldRunFollowUp ?
       oui → document_analysis (followUpKind) → enforceModeContract DOCUMENT (refus interdit)
       non → pipeline habituel
  → après analyse initiale réussie → recordActiveDocumentAnalysis
```

## Architecture runtime

| Module | Rôle |
| :--- | :--- |
| `documentTurnState.js` | Cache d’analyse gouverné par `sessionId` — artefact `document_briefing`, pas blob brut |
| `documentBriefingEncoder.js` | Production de l’artefact encodé (hash, keyBlocks, summary, pointeurs) |
| `documentFollowUpGuards.js` | Marqueurs de suivi + `classifyDocumentFollowUpKind` |
| `documentContinuityContext.js` | Résolution (store + repli historique), sérialisation LLM, `runDocumentFollowUp` |

**Forge** : `getDocumentImprovementSystemPrompt()` — contrat DOCUMENT pour tours de suivi (améliorations ancrées, blocs cités, pas de `INSUFFICIENT_SIGNAL_REFUSAL` si contexte actif).

**Chemins télémétrie** : `document_analysis_followup`, `document_needs_raw_reingest`.

### Artefact encodé (`document_briefing`)

Formule :

> pièce jointe brute → analyse initiale → **briefing encodé** → réutilisation follow-up → retour au brut seulement si nécessaire.

L’état session ne persiste **pas** le fichier intégral. Il encode une **représentation de travail** :

- identité : `documentId` (sha256), `filename`, `mime`, `sizeBytes`, `kind` ;
- structure : `keyBlocks[]` (sélecteurs, extraits bornés ≤ 420 car., offsets ligne) ;
- synthèse : `summary`, `limits`, `lastAnalysisExcerpt` (tronqué) ;
- statut : `followUpEligible`, `lastAnalysisKind`, `analysisRichness` (`full` | `analysis_only`).

Ré-ingestion brute déclenchée si `needsRawDocumentReingest` (ligne par ligne, citation exacte sans source, fichier modifié, etc.).

### Repli historique

Si le store session est vide (redémarrage process), `inferDocumentStateFromHistory` reconstruit un `document_briefing` en `analysis_only` à partir d’une réponse assistant structurée (ex. « Points clés »). Contexte **moins riche** mais évite une rupture totale de continuité.

Persistance DB session pour conserver `analysisRichness: full` après restart : voir [[02-Architecture/adr/ADR-20260606-Session-Document-Briefing-Persistence|ADR-20260606 — proposé, non implémenté]].

### Invalidation

- Nouvelle pièce jointe textuelle (nom différent) → effacement du contexte session précédent.
- Marqueurs explicites : nouveau fichier / oublie le document / change de sujet.

## Conséquences

- **Positif** : follow-ups « améliorer / corriger / ce bloc » exploitent le travail déjà fait ; alignement avec la mémoire de fil et le protocole de continuité.
- **Coût** : un tour LLM DOCUMENT supplémentaire sur les suivis (budget acceptable, 1 expert actif).
- **Risque évité** : faux refus « pas assez d’éléments fiables » quand la preuve locale est déjà dans le fil.

## Validation

| Type | Commande / critère |
| :--- | :--- |
| Unitaire | `node --test tests/document-continuity-context.test.js` + `tests/document-briefing-encoder.test.js` |
| Terrain | `mon_css.css` → analyse → « tu peux proposer des améliorations ? » → log `[PIPELINE] document_analysis_followup → mon_css.css improvement` |

## Liens

- [[02-Architecture/adr/ADR-004-Continuity-Protocol|Protocole de continuité (génération longue)]]
- [[02-Architecture/adr/ADR-20260601-Memoire-Fil|Mémoire de fil]]
- [[02-Architecture/adr/ADR-20260601-Micro-Conversation-Delestage|Micro-délestage conversationnel]]
- [[02-Architecture/adr/ADR-20260604-Auto-Reply-Sufficiency|Suffisance des auto-réponses]]
- [[02-Architecture/modules/Module-Agent-Pipeline|Pipeline agent]] (branchement `agentPipeline.js`)
- [[00-Foundation/VAULT-GOVERNANCE|Gouvernance du Vault]]
