# ADR - Refonte Conversationnelle Multi-Tours de Nexxus

## Vue d'ensemble
La refonte a déplacé Nexxus d'un comportement principalement guidé par des heuristiques locales vers une architecture hybride fondée sur la compréhension sémantique, la réécriture contextuelle et une politique explicite de suivi multi-tours. La baseline d'audit a montré que les questions simples et certaines formulations bancales étaient déjà correctement traitées, mais que le maintien du contexte au-delà du premier tour échouait fortement, ce qui justifiait une migration ciblée vers un suivi conversationnel plus structuré.

## Avant la refonte
Avant la refonte, le système reposait surtout sur des heuristiques de forme, des filtres de longueur et des garde-fous de clarification ou de fallback qui pouvaient écraser des réponses courtes pourtant utiles. Cette approche rendait Nexxus sensible aux paraphrases, aux formulations bancales et surtout aux suivis conversationnels, car la requête était souvent traitée comme un message isolé plutôt que comme une continuation d'un sujet déjà établi.

Les effets observés étaient typiques d'un assistant peu robuste en multi-tours : clarifications inutiles, retours à des messages génériques, oubli du sujet précédent, et réintroduction encyclopédique du thème au lieu de répondre au sous-aspect demandé.

## Après la refonte
La nouvelle architecture introduit un préprocesseur sémantique qui reconstruit la requête utilisateur sous forme canonique, extrait l'intention, le sujet courant, les aspects déjà explorés et la référence de suivi avant le routage final. Cette étape s'appuie sur une logique de contextual query rewriting, pratique reconnue pour transformer des suivis implicites comme “et son poids ?” en requêtes autonomes exploitables sans perdre le sujet actif.

Le pipeline distingue désormais plus clairement compréhension, décision et rendu, ce qui permet au routeur et au compositeur final d'agir sur un état conversationnel reconstruit plutôt que sur la seule phrase brute. La Follow-up Policy empêche en outre le renderer de redéfinir le sujet général lorsqu'un sous-thème précis est déjà demandé dans un tour ultérieur.

## Différences clés

| Axe | Avant | Après |
|---|---|---|
| **Compréhension de la requête** | Heuristiques locales, sensibles à la forme de phrase. | Pré-analyse sémantique avec requête canonique et état reconstruit. |
| **Routage** | Principalement déterminé par règles et indices textuels superficiels. | Routage appuyé sur intention, sujet, ambiguïté et contexte conversationnel. |
| **Réponses courtes** | Risque de censure par filtres de longueur ou fallback maladroit. | Validation par utilité minimale, avec conservation des réponses brèves mais valides. |
| **Multi-tours** | Perte fréquente du sujet au-delà du premier tour. | Réécriture contextuelle des suivis et maintien du sujet actif sur les tours courts. |
| **Follow-up précis** | Tendance à redemander ou à refaire une introduction générale. | Réponse ciblée sur le sous-thème demandé grâce à une policy dédiée. |
| **Résilience** | Correctifs successifs cas par cas. | Architecture plus explicite, mesurable et testable par baseline puis régression. |

## Gains attendus
Le principal gain est une meilleure robustesse aux formulations naturelles, imparfaites ou elliptiques, ainsi qu'une nette amélioration de la continuité conversationnelle sur les suivis immédiats. Cette évolution rapproche Nexxus d'un assistant réellement conversationnel, capable de répondre à l'intention reconstruite la plus probable au lieu de réagir à la seule surface grammaticale du dernier message.

Sur le plan d'ingénierie, la refonte apporte aussi une structure plus saine pour les audits futurs : baseline, jeux de tests par familles, comparaison avant/après, puis extension progressive du state management. Cela permet de sortir durablement du cycle des patchs ponctuels en remplaçant les intuitions locales par un pipeline observable et réévaluable.

## Points à surveiller
La nouvelle architecture devra encore être surveillée sur la calibration des scores de confiance, les faux positifs de réécriture, les changements de sujet rapides et les conversations plus longues que la fenêtre glissante courante. Les bonnes pratiques d'évaluation multi-tour recommandent justement de rejouer régulièrement les mêmes scénarios de référence et d'ajouter progressivement des cas réels plus difficiles pour éviter les régressions silencieuses.
