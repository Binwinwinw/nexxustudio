# Root Cause Analysis (RCA) : Erreur de Routage "code_generation" sur Requêtes Pédagogiques

**Date** : 12/06/2026
**Système affecté** : `intentTriageClassifier`, `codeDeliveryPolicy`, `justIntentDetectionPolicy`
**Version déployée** : 2.1.0-unicode-routing

## 1. Symptôme
Des requêtes utilisateur demandant clairement un contenu pédagogique ou une planification structurée (ex. : *"Fais un plan pour un atelier d’initiation à Python en 5 sections avec objectifs et durée"*) étaient faussement classifiées avec l'intention `code/create` (`CODE_GENERATION`). 
Le système appliquait alors le contrat `CODE_DELIVERY_V1`, produisant une réponse orientée "livrable de code" au lieu d'un plan de cours.

## 2. Cause Racine
Trois facteurs ont contribué à cette régression de routage :
1. **Surpondération des tokens langages** : La simple présence d'un nom de langage (ex. "Python") déclenchait le modificateur multi-langages.
2. **Heuristiques lexicales trop larges** : La regex `DELIVERABLE_SIGNAL_RE` incluait des termes génériques comme `atelier`, `peux tu`, provoquant un faux positif dès qu'ils étaient associés à un langage. De plus, une règle forçait `true` si un langage était détecté dans une requête de plus de 50 caractères.
3. **Bugs de frontières de mots Unicode** : Les lettres accentuées majuscules (ex. `Écris`) échouaient lors du pattern matching regex JavaScript natif basé sur `\b`, menant à des faux négatifs sur de vraies demandes de code, et déséquilibrant les scores.

## 3. Correctifs Apportés
- **Règles négatives prioritaires** : Ajout d'un coupe-circuit `isPedagogicalPlanningRequest` vérifiant si la requête relève d'une demande de plan/atelier sur un langage. Ce coupe-circuit s'exécute *avant* l'évaluation d'un livrable de code.
- **Normalisation Unicode** : Implémentation d'une fonction `normalizeIntentText()` qui supprime les diacritiques (NFD) avant l'application des heuristiques lexicales, garantissant un matching parfait pour `Écris`, `Développe`, etc.
- **Nettoyage lexical** : Suppression de `q.length >= 50` et des faux signaux (ex: "atelier") de `DELIVERABLE_SIGNAL_RE`. Ajout de `page web`, `composant`, `application` dans `EXPLICIT_CODE_REQUEST_RE`.
- **Golden Tests** : 20 tests injectés dans `code-generation-routing.test.js` incluant des invariants stricts de Triage.

## 4. Monitoring & Alertes
Une surveillance renforcée devra être maintenue via de nouvelles "slices" dans les métriques :
- **Taux de requêtes pédagogiques faussement routées vers `code_generation`**
- **Taux de faux négatifs sur de vraies demandes de code (défauts `\b`)**
- **Part des messages de fallback statique après routage `code/create`**

*(Note : Ces métriques permettront de valider la stabilité de la version 2.1.0-unicode-routing).*
