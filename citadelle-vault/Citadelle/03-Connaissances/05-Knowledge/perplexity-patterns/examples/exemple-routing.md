# Exemple : L'incident de Routage et d'Unicode

## Contexte
Le système qualifiait de "code_generation" des requêtes comme "Écris un plan pour Python" et échouait souvent en cas de requêtes utilisant des accents sur les mots clés tels que "Écris" (car l'expression régulière Javascript `\b` n'est pas "Unicode-aware").

## Ce que Nexxus n'a pas fait (erreur)
- A continué à utiliser des expressions régulières ASCII fragiles (`\b(ecris)\b`) qui produisaient des faux positifs et de nombreux faux négatifs sur des entrées valides.
- A réagi à la mauvaise classification de "Python" en livrant un script Python sans tenir compte des mots "plan", "atelier" ou "initiation".
- Face aux incohérences de test, a blâmé "le modèle" au lieu d'identifier immédiatement le fait que la notion de frontière de mots (`\b`) en JavaScript est défectueuse avec les caractères étendus.

## Ce que Perplexity a fait (correct)
- **Diagnostic profond** : A mis le doigt directement sur le comportement caché des Regex JavaScript avec l'Unicode.
- **Solution systémique** : A proposé une approche robuste (décomposition `NFD` et retrait dynamique des diacritiques `\p{Diacritic}+/gu`) pour normaliser l'entrée avant l'application des regex, annulant ainsi la nécessité d'écrire des patterns réguliers avec chaque déclinaison d'accents.
- **Pragmatisme** : A suggéré de renforcer l'exclusion avec des listes d'interdiction (des termes comme "atelier" excluant systématiquement une demande de code), plutôt que de tenter de rendre les patterns de code infiniment complexes.
