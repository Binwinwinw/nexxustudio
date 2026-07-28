# ADR-004 : Continuity Protocol (v1.3 - Stateful Weld)

**Statut** : Actif (Audit SOTA)
**Version** : 1.3

## 🎯 Objectif
Éliminer les répétitions et les dérives structurelles lors des générations longues en imposant une reprise par **État Compact**.

## 🛡️ Règle de Pause (Checkpoint)
À chaque pause forcée par la limite de tokens, le système génère un bloc technique de sortie :
```text
[PAUSE_STATE]
- document: [nom_du_fichier]
- section_courante: [titre_section]
- dernier_point_termine: [dernier_élément_produit]
- prochain_point: [prochain_élément_attendu]
- blocs_ouverts: [html/code/liste/aucun]
```

## 🔄 Règle de Reprise (Soudure de Fer)
Lors du signal de reprise ("Oui"), le système suit ces contraintes absolues :
1. **Interdiction de répétition** : Ne jamais réémettre les en-têtes, introductions ou sections déjà validées.
2. **Démarrage Direct** : La sortie doit commencer par le premier mot du prochain paragraphe ou la ligne suivante du bloc de code, sans préambule.
3. **Priorité d'État** : Le checkpoint de reprise est l'unique boussole de la génération.

## 🚫 Interdictions Strictes
- Pas de réintroductions du type "NEXXUS : ...", "RAPPORT : ...".
- Pas de rappel des objectifs ou des scores déjà affichés.
- Pas de fermeture/réouverture de balises structurelles déjà présentes dans le segment précédent.

## 💡 Exemple de Comportement Attendu
*Segment 1 se finit sur une liste inachevée.*
*User dit "Oui".*
*Segment 2 commence par :* `- Point suivant de la liste...` *(et non par "Voici la suite du document...")*

---
### 🔗 Liens de Parenté
- [[Wiki/Wiki-ADRs-Index|🧬 Retour à l'Atlas des ADRs]]
- [[00-Manifeste-Doctrine|📜 Manifeste de la Citadelle]] (v4.5)
- [[Bienvenue|⬅ Retour à l'Index Central]]

