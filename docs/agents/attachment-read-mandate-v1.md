# Mandat lecture pièce jointe — `ATTACHMENT_READ_MANDATE_V1`

Note doctrinale. La logique n’est pas ici : elle est déjà verrouillée dans le code.

## Source de vérité

- Contrat : `ATTACHMENT_READ_MANDATE_CONTRACT` dans `server/src/agent/policies/attachment/attachmentReadMandatePolicy.js`
- Cadrage : `resolveAttachmentFraming` dans `server/src/agent/policies/attachment/attachmentTaskPolicy.js`
- Preuves : `server/tests/attachment-read-mandate.test.js` (cas structurants + suite raster `image/*`), plus `attachment-task-policy.test.js` et `routing-case-dictionary.test.js` (fiche `document_attached_guard` ; image seule ≠ cette fiche)

## Quand le mandat s’active

Le mandat s’applique seulement s’il y a **à la fois** un verbe de travail (améliorer, résumer, analyser, corriger, …) **et** un joint **documentaire** exploitable : mention explicite du fichier **texte**, ou pièce jointe texte déjà là.

Une PJ **image seule** **n’active pas** le mandat. Filtre : chaque attachment a un MIME `image/*` (png, jpeg, gif, webp, …), ou une extension raster si le MIME manque. « Analyse le fichier » + `.jpg` / `.png` / `.gif` / `.webp` reste le rail Vision (`VISION_ATTACHED`), pas un ingest document. SVG est refusé plus tôt par FILE_CAPABILITY. Un salut + un fichier, sans demande de travail, **n’active pas** non plus le mandat. La clarification reste licite hors Vision explicite.

## Ce qu’il interdit

Une fois le mandat actif :

1. **Répondre sans avoir lu** le joint. L’ingest précède toute réponse de contenu.
2. **Inventer** des axes, un résumé ou une revue si le fichier est illisible ou vide. On s’arrête.
3. **Clarifier l’objectif** quand le fichier **est** la cible (« améliore ça », « résume le fichier joint »). Même vague : si le fichier est lisible, on travaille dessus. On ne redemande pas « quel est ton objectif ? ».
4. **Une réponse générique** qui n’utilise pas le joint. La preuve d’usage est obligatoire : un span source ≥ 16 caractères, ou au moins 2 tokens distinctifs du fichier (les verbes de travail ne comptent pas).

Si le fichier **texte** est illisible ou vide, on demande **un fichier lisible**, pas un nouvel objectif. Si l’échec porte sur une **image**, on dit l’incertitude vision — jamais « fichier vide / trop court » (canon : invariant 10).

## Priorité de cadrage

`resolveAttachmentFraming` tranche dans cet ordre, et seulement cet ordre :

1. **`request_nature`** — sécu, corriger, refactor, « le code », XSS, DOM → le fichier reste **code**, même s’il est `.html`.
2. **`work_verb`** — améliorer / résumer **sans** nature code → un `.html` pédagogique devient **document**.
3. **`file_type`** — à défaut, `.html` est **code** (ex. « analyse le fichier joint » sur `index.html` → revue de code).

C’est pourquoi le même `.html` peut être document **ou** code : ce n’est pas l’extension qui décide en premier, c’est la nature de la demande.

## Pourquoi un lecteur externe doit retenir ça

| Question | Réponse courte |
|----------|----------------|
| Pourquoi un `.html` peut être document ou code ? | L’extension est le dernier critère. Un guide pédagogique + « axes d’amélioration » est un document. Le même type de fichier + « corrige le XSS » est du code. |
| Pourquoi la clarification est parfois interdite ? | Dès que le fichier est la cible de travail et qu’il est lisible, redemander l’objectif est un faux recadrage. La clarification reste licite seulement si le mandat ne s’applique pas, ou si on demande un fichier lisible. |
| Pourquoi la preuve d’usage du joint est obligatoire ? | Sans ancrage dans le texte ingéré, le modèle produit une réponse générique (ou une « piste ») qui ignore le fichier. Le critic `file_not_used` / `generic_answer_without_document` n’est pas un style : c’est le contrat. |

## Ce que cette note ne rouvre pas

Pas de nouveau rail DOCUMENT, pas de changement de composer global, pas de nouveau critère de cadrage. Si le comportement doit bouger, on change le contrat et `resolveAttachmentFraming`, puis les tests cités ci-dessus — pas cette page.
