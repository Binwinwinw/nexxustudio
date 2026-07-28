# Pattern Library — Nexxus

Ce catalogue regroupe les 10 patterns canoniques permettant de concevoir, d'évaluer et d'améliorer la compréhension des intentions multi-tours de Nexxus. L'objectif n'est pas de créer une règle par exemple, mais de couvrir les familles de variantes (paraphrases, fautes, inversions d'ordre, omissions) pour s'assurer que le routeur sémantique reste robuste.

---

## 1. intro_bot_identity_capabilities
- **Structure logique :** `[salutation] + [identité du bot] + [priorités] + [capacités]`
- **Sous-intents attendus :** `social.greeting`, `identity.bot_name`, `meta.priorities`, `meta.capabilities`
- **Policy de réponse :**
  - Salutation courte (1 phrase).
  - Identité claire (nom du bot).
  - Priorités (3 points max).
  - Capacités (3–4 points max).
  - Ouverture discrète (optionnelle).
- **Variantes attendues (10) :**
  - "bonjour comment t'appelles tu??? quelles sont tes priorités???? quelles sont tes fonctionnalités???"
  - "salut, tu t’appelles comment, et tu fais quoi ?"
  - "Qui es-tu, quelles sont tes priorités et ce que tu peux faire ?"
  - "c koi ton nom, tes priorités et tu sers à quoi ?"
  - "présente-toi : nom, priorités, capacités"
  - "tu t’appelles comment, tu privilégies quoi, et tu sais faire quoi ?"
  - "j’aimerais savoir qui tu es, ce que tu privilégies, et ce que tu sais faire"
  - "salut, tu sers à quoi, t’es qui ?"
  - "bonjour, tu peux dire ton nom, tes buts, et tes fonctions ?"
  - "qui tu es, tu fais quoi, et tu privilégies quoi ?"
- **Cas adversariaux (3) :**
  - "nom, priorités, fonctions, vite"
  - "bonjour, t’es qui, tu fais quoi, t’as quoi en tête ?"
  - "c koi ton nom, c koi tes priorités, c quoi tes fonctions"

---

## 2. bot_role_and_scope
- **Structure logique :** `[salutation] + [rôle du bot] + [domaine de compétence]`
- **Sous-intents attendus :** `social.greeting`, `meta.bot_role`, `meta.scope`
- **Policy de réponse :**
  - Salutation courte.
  - Description du rôle (1–2 phrases).
  - Domaine explicité.
  - Offre d’aide sur ce domaine.
- **Variantes (10) :**
  - "salut, tu es quoi exactement, et sur quoi tu peux m’aider ?"
  - "bonjour, tu fais quel métier, tu couvres quoi ?"
  - "c koi ton job, tu peux m’aider sur quoi ?"
  - "tu es un assistant, tu t’occupes de quoi ?"
  - "présente ton rôle, et ton domaine d’action"
  - "tu es conçu pour quoi, tu opères sur quel champ ?"
  - "mission, tu es quoi, tu fais quoi ?"
  - "salut, tu joues quel rôle, tu couvres quel champ ?"
  - "quel est ton rôle, et quelles sont tes limites ?"
  - "tu es censé faire quoi, et dans quel domaine ?"
- **Cas adversariaux (3) :**
  - "rôle, domaine, vite"
  - "c koi ton job, t’as des limites ?"
  - "tu es quoi, tu fais quoi, tu peux pas faire quoi ?"

---

## 3. bot_limitations_and_red_flags
- **Structure logique :** `[salutation] + [limites du bot] + [cas interdits / red flags]`
- **Sous-intents attendus :** `social.greeting`, `meta.limitations`, `meta.red_flags`
- **Policy de réponse :**
  - Salutation courte.
  - Limites claires (2–3 points).
  - Cas interdits (2 points).
  - Proposition de clarification.
- **Variantes (10) :**
  - "salut, tu ne peux pas faire quoi, et tu as quelles limites ?"
  - "bonjour, où tu blocs, et tu as des interdits ?"
  - "t’as des limites, tu ne peux pas faire quoi ?"
  - "quelles sont tes limites, et quand tu dis non je peux pas ?"
  - "tu ne fais pas quoi, et tu dis jamais que tu peux pas ?"
  - "présente tes limites et tes interdits"
  - "tu as des bords, tu ne fais pas quoi ?"
  - "quand tu ne peux pas faire quelque chose, c quand ?"
  - "tu ne peux pas faire ça, mais tu ne fais pas quoi ?"
  - "c koi tes limites, et tu ne fais pas quoi ?"
- **Cas adversariaux (3) :**
  - "limites, interdits, vite"
  - "t’as pas de limites, tu fais tout ?"
  - "tu ne peux pas faire ça, tu peux faire ça ?"

---

## 4. bot_memory_and_context_behavior
- **Structure logique :** `[salutation] + [mémoire du bot] + [gestion du contexte]`
- **Sous-intents attendus :** `social.greeting`, `meta.memory`, `meta.context_behavior`
- **Policy de réponse :**
  - Salutation courte.
  - Précision sur la mémoire (court terme / long terme).
  - Gestion du contexte (multi-tours, résolutions).
  - Proposition d’aide.
- **Variantes (10) :**
  - "salut, tu gardes quoi en mémoire, et tu gères comment le contexte ?"
  - "bonjour, tu te rappelles de quoi, et tu tiens le contexte ?"
  - "t’as de la mémoire, tu tiens le contexte ?"
  - "tu gardes quoi en tête, tu suivies le contexte ?"
  - "mémoire, tu retiens quoi, contexte, tu fais quoi ?"
  - "présente ta mémoire et ta gestion du contexte"
  - "tu as une mémoire, tu suivies les échanges ?"
  - "tu te rappelles de quelque chose, tu tiens en fil ?"
  - "quand tu parles, tu gardes quoi en mémoire ?"
  - "c koi ta mémoire, tu gères quoi comme contexte ?"
- **Cas adversariaux (3) :**
  - "mémoire, contexte, vite"
  - "tu retiens rien, tu oublies tout ?"
  - "tu gardes quoi, tu oublies quoi ?"

---

## 5. bot_orientations_and_values
- **Structure logique :** `[salutation] + [valeurs du bot] + [orientations éthiques]`
- **Sous-intents attendus :** `social.greeting`, `meta.values`, `meta.ethics`
- **Policy de réponse :**
  - Salutation courte.
  - Valeurs exprimées en 2–3 points.
  - Orientations éthiques en 2 points.
  - Proposition de question.
- **Variantes (10) :**
  - "salut, tu as quelles valeurs, et tu privilégies quoi ?"
  - "bonjour, tu suis quoi comme principes, et tu privilégies quoi ?"
  - "t’as des valeurs, tu privilégies quoi ?"
  - "quelles sont tes valeurs, et tu fais réfléchir sur quoi ?"
  - "valeurs, tu privilégies quoi, principes, tu fais quoi ?"
  - "présente tes valeurs et tes principes"
  - "tu as des valeurs, tu fais quoi ?"
  - "tu privilégies quoi, tu fais quoi de l’éthique ?"
  - "quand tu parles, tu fais quoi comme valeurs ?"
  - "c koi tes valeurs, tu privilégies quoi ?"
- **Cas adversariaux (3) :**
  - "valeurs, principes, vite"
  - "tu fais rien, tu dis tout ?"
  - "tu privilégies quoi, tu fais quoi ?"

---

## 6. bot_interaction_style_and_tone
- **Structure logique :** `[salutation] + [style d’interaction] + [ton]`
- **Sous-intents attendus :** `social.greeting`, `meta.tone`, `meta.interaction_style`
- **Policy de réponse :**
  - Salutation courte.
  - Style d’interaction (1–2 phrases).
  - Ton (1–2 phrases).
  - Proposition d’aide.
- **Variantes (10) :**
  - "salut, tu parles comment, tu as quel ton ?"
  - "bonjour, tu interagis comment, tu as quel style ?"
  - "tu parles normal, tu as quel ton ?"
  - "ton, tu parles comment, style, tu fais quoi ?"
  - "présente ton style et ton ton"
  - "tu interagis comment, tu parles comment ?"
  - "tu as quel ton, tu fais quoi ?"
  - "tu parles sérieux, tu fais quoi ?"
  - "quand tu parles, tu fais quoi comme ton ?"
  - "c koi ton ton, tu parles comment ?"
- **Cas adversariaux (3) :**
  - "ton, style, vite"
  - "tu parles neutre, tu fais quoi ?"
  - "tu parles quoi, tu fais quoi ?"

---

## 7. bot_capabilities_by_domain
- **Structure logique :** `[salutation] + [domaine A] + [capacités]`
- **Sous-intents attendus :** `social.greeting`, `domain.*`, `meta.capabilities`
- **Policy de réponse :**
  - Salutation courte.
  - Reconnaissance du domaine.
  - Capacités dans ce domaine (2–3 points).
  - Proposition d’exploration.
- **Variantes (10) :**
  - "salut, tu peux m’aider en code, et tu fais quoi ?"
  - "bonjour, tu peux faire du code, tu fais quoi ?"
  - "code, tu peux faire quoi ?"
  - "tu peux coder, tu fais quoi ?"
  - "présente tes capacités en code"
  - "tu peux faire du code, tu fais quoi ?"
  - "tu peux coder, tu fais quoi ?"
  - "tu fais du code, tu fais quoi ?"
  - "tu peux faire du code, tu fais quoi ?"
  - "c koi tu fais en code ?"
- **Cas adversariaux (3) :**
  - "code, vite"
  - "tu peux coder, tu peux pas coder ?"
  - "tu fais du code, tu fais pas quoi ?"

---

## 8. bot_help_and_task_request
- **Structure logique :** `[salutation] + [demande d’aide] + [tâche spécifique]`
- **Sous-intents attendus :** `social.greeting`, `help.request`, `task.specific`
- **Policy de réponse :**
  - Salutation courte.
  - Reconnaissance de la demande.
  - Proposition d’aide.
  - Clarification si nécessaire.
- **Variantes (10) :**
  - "salut, tu peux m’aider, et tu fais quoi ?"
  - "bonjour, tu peux m’aider, tu fais quoi ?"
  - "aide, tu peux faire quoi ?"
  - "tu peux m’aider, tu fais quoi ?"
  - "présente ton aide, et tes tâches"
  - "tu peux m’aider, tu fais quoi ?"
  - "tu peux aider, tu fais quoi ?"
  - "tu aides, tu fais quoi ?"
  - "tu peux m’aider, tu fais quoi ?"
  - "c koi tu fais pour m’aider ?"
- **Cas adversariaux (3) :**
  - "aide, vite"
  - "tu peux aider, tu peux pas aider ?"
  - "tu aides, tu fais pas quoi ?"

---

## 9. bot_self_reflection_and_limits_of_knowledge
- **Structure logique :** `[salutation] + [prise de recul du bot] + [limites de connaissance]`
- **Sous-intents attendus :** `social.greeting`, `meta.self_reflection`, `meta.knowledge_limits`
- **Policy de réponse :**
  - Salutation courte.
  - Prise de recul (1–2 phrases).
  - Limites de connaissance (2 points).
  - Proposition de question.
- **Variantes (10) :**
  - "salut, tu fais recours sur toi, et tu connais pas quoi ?"
  - "bonjour, tu fais retour sur toi, tu connais pas quoi ?"
  - "tu fais recours, tu connais pas quoi ?"
  - "tu fais retour, tu connais pas quoi ?"
  - "présente ton retour et tes limites"
  - "tu fais retour, tu fais quoi ?"
  - "tu fais retour, tu connais pas quoi ?"
  - "tu fais retour, tu fais quoi ?"
  - "tu fais retour, tu connais pas quoi ?"
  - "c koi tu fais pour te retourner ?"
- **Cas adversariaux (3) :**
  - "retour, limites, vite"
  - "tu connais tout, tu connais pas quoi ?"
  - "tu fais retour, tu fais pas quoi ?"

---

## 10. bot_orchestrator_and_routing_behavior
- **Structure logique :** `[salutation] + [rôle de l’orchestrateur] + [routage]`
- **Sous-intents attendus :** `social.greeting`, `meta.orchestrator_role`, `meta.routing_behavior`
- **Policy de réponse :**
  - Salutation courte.
  - Rôle de l’orchestrateur (1–2 phrases).
  - Routage (2 points).
  - Proposition d’aide.
- **Variantes (10) :**
  - "salut, tu orchestres comment, et tu routes comment ?"
  - "bonjour, tu orchestres quoi, tu routes quoi ?"
  - "orchestration, tu fais quoi ?"
  - "tu orchestres, tu routes quoi ?"
  - "présente ton orchestration et ton routage"
  - "tu orchestres, tu fais quoi ?"
  - "tu orchestres, tu routes quoi ?"
  - "tu orchestres, tu fais quoi ?"
  - "tu orchestres, tu routes quoi ?"
  - "c koi tu fais en orchestration ?"
- **Cas adversariaux (3) :**
  - "orchestration, routage, vite"
  - "tu orchestres tout, tu routes tout ?"
  - "tu orchestres, tu fais pas quoi ?"
