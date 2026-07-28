# Audit — Continuité d'engagement et handoff

## Statut
Audit Read-Only exécuté, sans modification fonctionnelle du code.

## Objectif
Vérifier que les relances courtes de type acquiescement, poursuite ou action implicite s’attachent correctement au contexte local du tour précédent, au sujet actif, ou au document actif.

## Scénarios audités
- `follow_up_after_offer`
- `active_subject_handoff`
- `document_followup_continuity`

## Résultats
### 1. follow_up_after_offer
Cas testé :
- assistant : proposition explicite de détailler une structure
- utilisateur : “Oui, vas-y”

Résultat observé :
- aucune continuité détectée (`null`)

Conséquence :
- la réponse de l’utilisateur n’est pas reconnue comme acceptation de l’offre précédente ;
- le pipeline perd l’engagement conversationnel local.

Couche suspecte :
- `conversationContinuityContext.js`
- `resolveConversationContinuityShortCircuit`
- détection de pattern d’offre / élaboration trop étroite.

### 2. active_subject_handoff
Cas testé :
- assistant : explication déjà en cours sur un sujet technique
- utilisateur : “Continue”

Résultat observé :
- aucune continuité détectée (`null`)

Conséquence :
- le système ne rattache pas la relance au sujet technique actif ;
- il traite potentiellement le tour comme une requête générique ou insuffisante.

Couche suspecte :
- `conversationContinuityContext.js`
- patterns de follow-up trop dépendants d’une offre explicite précédente.

### 3. document_followup_continuity
Cas testé :
- `activeDocumentAnalysis` présent, document actif : `app.js`
- utilisateur : “Propose des améliorations”

Résultat observé :
- `top_intent = general`
- confiance moyenne

Conséquence :
- la requête n’est pas reliée au document actif ;
- le handoff vers `document_analysis` / `code_review` n’a pas lieu.

Couche suspecte :
- `intentTriageClassifier.js`
- absence ou faiblesse d’usage de `sessionContext.activeDocumentAnalysis` dans le triage primaire.

## Conclusion
L’audit confirme deux ruptures structurelles de continuité locale :
1. la continuité d’engagement conversationnel est trop rigide ;
2. le triage primaire ne tient pas assez compte des objets actifs en mémoire locale, notamment les documents.

## Décision
Ne pas patcher à l’aveugle.  
La correction doit être chirurgicale et ciblée sur :
- `conversationContinuityContext.js`
- `intentTriageClassifier.js`

## Prochaine étape
Préparer un plan de correction ciblé pour :
- rattacher les acquiescements courts à une offre précédente ;
- rattacher “continue” à un sujet technique actif ;
- prioriser le document actif dans le triage des relances semi-ambiguës.

## Doctrine associée
Une relance courte ne doit pas être évaluée comme une requête isolée si un engagement local, un sujet actif ou un document actif existe déjà dans le fil.
