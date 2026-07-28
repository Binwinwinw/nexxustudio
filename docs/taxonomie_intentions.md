# Taxonomie et Compartiments de Routage Nexxus

Ce document définit la taxonomie cible pour le routage sémantique de La Citadelle. Cette taxonomie sert de base pour l'évaluation (Baseline) et la migration vers le routage multi-tours.

## Hiérarchie des Compartiments

| Niveau 1 | Niveau 2 possibles | Objectif & Comportement |
|---|---|---|
| **Conversation générale** | salutation, échange libre, suivi de discussion | Garder le fil, réponse courte et conviviale. |
| **Culture générale** | définition, explication, comparaison simple | Répondre directement et factuellement sans déléguer aux experts lourds. |
| **Sujet à forger** | rédaction, création, plan, document, mail, prompt | Produire un livrable structuré via la Forge (document-analysis, etc). |
| **Réflexion complexe** | analyse, architecture, arbitrage, stratégie | Raisonner en profondeur (consensus séquentiel, tricéphale). |
| **Action technique** | code, debug, modification, commande | Exécuter une action, interagir avec le système de fichiers. |
| **Clarification requise** | ambiguïté réelle, objet manquant, contradiction | Poser **une seule question** ciblée, sans générer de réponse de contenu. |

## Principes de Classification

L'architecture ne doit pas se limiter à un simple "intent classifier", mais produire un objet structuré comprenant :

1. **Sujet principal** (ex: "smartphones pliables")
2. **Intention / Action** (ex: "approfondissement")
3. **Niveau de complexité** (faible/moyenne/haute)
4. **Nécessité de clarification** (oui/non)
5. **Continuité** (sujet hérité du tour précédent ou nouveau)

## Résolution des Anaphores et Follow-ups
- Toute requête utilisateur contenant un pronom de rappel ("ça", "il", "ce sujet") doit hériter de son sujet via l'historique conversationnel.
- L'approfondissement d'un sous-thème (ex: "et le poids ?") ne déclenche pas une clarification générale, mais une réponse factuelle sur ce sous-thème rattachée au sujet principal.
