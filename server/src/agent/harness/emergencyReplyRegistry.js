/* server/src/agent/harness/emergencyReplyRegistry.js */
import { normalizeText } from "../utils/normalizationGuards.js";
import { isAnalyticalTechnicalRequest, isTechnicalStatusReport } from "../utils/conversationGuards.js";

class EmergencyReplyRegistry {
  constructor() {
    this.replies = [
      {
        id: "forge_timing",
        patterns: ["forge"],
        keywords: [
          "quand",
          "moment",
          "envoyer",
          "transmettre",
          "prendre le relais",
        ],
        response:
          "Le projet doit etre envoye a la Forge quand il est suffisamment cadre et valide. En pratique, la Forge prend le relais une fois la phase de validation terminee et lorsque le projet est pret pour la production.",
      },
      {
        id: "forge_handoff_procedure",
        patterns: ["forge", "projet"],
        keywords: [
          "comment",
          "faire",
          "lancer",
          "declench",
          "declencher",
          "envoyer",
          "passer",
        ],
        response: [
          "Pour declencher la Forge depuis un projet : cadrer le projet dans la session, valider la maturite, puis lancer le handoff vers la chaine de generation (orchestrateur, route API ou action pipeline selon ton setup).",
          "",
          "L'assistant structure avant la Forge ; la Forge materialise quand le contrat de verite est satisfait.",
          "",
          "Si tu veux, je detaille le chemin exact selon ton backend actuel.",
        ].join("\n"),
      },
      {
        id: "self_identity",
        maxWords: 20,
        patterns: ["toi"],
        keywords: [
          "te considère",
          "te consideres",
          "comment tu te",
          "tu te définis",
          "tu te definis",
          "es-tu",
          "t'appelles",
          "tu es",
        ],
        contextKeywords: [
          "modèle",
          "llm",
          "agent",
          "orchestrateur",
          "ia",
          "intelligence artificielle",
        ],
        response: [
          "Je suis Nexxus, l'assistant de La Citadelle, et je fonctionne comme un agent orchestrateur léger.",
          "",
          "Mon rôle :",
          "- coordonner les sources de réponse,",
          "- sélectionner les experts internes ou les modèles pertinents,",
          "- synthétiser les résultats en une réponse claire et structurée.",
          "",
          "Ce que je ne suis pas :",
          "- je ne suis pas un agent autonome qui exécute des commandes système sans supervision utilisateur.",
          "- je ne suis pas seulement un simple chatbot générique.",
          "",
          "Ma nature :",
          "- je suis un assistant orienté projet,",
          "- j'oriente la conversation et je cadre les idées pour une clarté et une qualité professionnelle pour la production afin d'assurer le passage à la Forge.",
        ].join("\n"),
      },
      {
        id: "ai_agent_concept",
        maxWords: 20,
        patterns: [
          "agent ia",
          "agent ai",
          "agent intelligence artificielle",
          "agent artificielle",
          "agent intelligent",
        ],
        response: [
          "Un agent IA est un système capable de percevoir son environnement, de prendre des décisions et d'agir pour atteindre des objectifs définis.",
          "",
          "Principes :",
          "- Perception : collecte de signaux, données ou requêtes.",
          "- Décision : évaluation des options et planification d'actions.",
          "- Action : exécution ou déclenchement d'étapes pour atteindre un objectif.",
          "",
          "Différence avec un chatbot :",
          "- Un agent IA peut utiliser des outils, orchestrer plusieurs fonctions et adapter son comportement en fonction du contexte.",
          "- Un chatbot répond surtout aux messages, alors qu'un agent IA vise une mission plus large et des résultats concrets.",
        ].join("\n"),
      },
      {
        id: "self_evaluation",
        patterns: [
          "auto-évaluer",
          "auto evaluer",
          "auto-evaluation",
          "auto evaluation",
          "m'améliorer",
          "me améliorer",
          "points d'amélioration",
          "points d amelioration",
          "évaluer ta réponse",
          "évaluation",
          "auto-évaluation",
          "auto-eval",
          "feedback",
          "améliorer ta qualité",
          "améliorer ta réponse",
        ],
        response: [
          "Je peux m'auto-évaluer sur ma manière de répondre et sur les points où je dois m'améliorer.",
          "",
          "1. Ce que je dois vérifier :",
          "- Est-ce que je réponds directement à la question sans tourner autour du pot ?",
          "- Est-ce que ma réponse est structurée et orientée vers l'action ?",
          "- Est-ce que j'évite les phrases génériques de sécurité quand une réponse métier est possible ?",
          "- Est-ce que je choisis le bon niveau de détail pour l'utilisateur ?",
          "",
          "2. Points d'amélioration typiques :",
          "- Remplacer un message générique par une réponse spécifique et utile.",
          "- Privilégier la clarification de la demande avant de répondre si le besoin est flou.",
          "- Identifier si la question demande une explication métier, un diagnostic ou une stratégie.",
          "- Garder le focus sur le résultat attendu, pas sur le processus interne.",
          "",
          "3. En pratique :",
          "- Quand je détecte une demande d'auto-évaluation, je dois proposer un plan d'amélioration clair.",
          "- Je dois évoquer les critères de qualité : pertinence, clarté, structure, exhaustivité.",
          "- Je dois faire la différence entre une réponse utile et une simple phrase de disponibilité.",
          "",
          "En résumé, je dois traiter l'auto-évaluation comme une question métier : analyser l'intention, exposer des axes concrets d'amélioration et éviter de répondre par une formule neutre.",
        ].join("\n"),
      },
      {
        id: "orchestrator_concept",
        patterns: [
          "orchestrateur",
          "agent orchestrateur",
          "master orchestrateur",
          "maître orchestrateur",
          "maitre orchestrateur",
          "orchestration",
          "coordination",
          "chef d'orchestre",
          "juge cognitif",
          "sous-agent",
          "sous agent",
          "agents specialises",
          "agent principal",
        ],
        response: [
          "Oui. La Citadelle utilise un agent principal d'orchestration et des agents specialises.",
          "L'agent principal coordonne les decisions, les agents specialises executent des taches ciblees, et la Forge est le sous-systeme technique de production et transformation.",
          "La relation est fonctionnelle, pas ceremonielle.",
        ].join("\n"),
      },
      {
        id: "workshop_plan_4h",
        patterns: ["4 heures", "quatre heures", "4h"],
        keywords: [
          "deux sessions",
          "2 sessions",
          "matinée",
          "après-midi",
          "apres-midi",
        ],
        contextKeywords: [
          "plan",
          "atelier",
          "teams",
          "microsoft 365",
          "assistant intelligent",
          "teams 365",
        ],
        response: [
          "Oui, j'ai bien compris. Voici un plan de 4 heures structuré en deux sessions de 2 heures pour Teams 365 : une matinée pour débutants et intermédiaires, et un après-midi avancé centré sur l'assistant intelligent intégré.",
          "",
          "Session 1 – Matinée (2 heures) : Débutants / Intermédiaires",
          "- Objectifs : découvrir Teams, comprendre l'organisation des canaux, maîtriser les messages et les réunions de base.",
          "- Contenu : présentation de l'interface, équipes et canaux, messagerie, mentions, réunions simples et premiers partages de fichiers.",
          "- Exercices : envoyer un message dans un canal, participer à une réunion test, partager un document Microsoft 365.",
          "",
          "Session 2 – Après-midi (2 heures) : Avancé et assistant intelligent intégré",
          "- Objectifs : utiliser l'assistant Teams pour gagner en productivité, automatiser des tâches et travailler en contexte collaboratif.",
          "- Contenu : découverte de l'assistant intégré, commandes et suggestions proactives, intégration avec Microsoft 365, scénarios avancés de collaboration.",
          "- Exercices : demander à l'assistant de résumer une réunion, générer une tâche, trouver un fichier partagé et configurer un rappel dans Teams.",
          "",
          "Support animateur : prévoir un compte de démonstration, des captures d'écran de Teams, un guide de cas pratiques et une fiche de synthèse pour chaque session.",
        ].join("\n"),
      },
      {
        id: "workshop_plan_1h",
        patterns: ["atelier", "formation", "initiation"],
        keywords: [
          "plan",
          "objectifs",
          "déroulé",
          "deroule",
          "exercices",
          "support animateur",
        ],
        response: [
          "Oui. Voici un plan d'atelier d'initiation a Teams sur 1 heure.",
          "",
          "Objectifs :",
          "- Comprendre a quoi sert Teams dans Microsoft 365.",
          "- Savoir naviguer entre equipes, canaux, conversation et calendrier.",
          "- Envoyer un message, participer a une reunion et partager un fichier.",
          "",
          "Deroule :",
          "- 0 a 10 min : introduction, objectifs, presentation de l'interface Teams.",
          "- 10 a 25 min : equipes, canaux, conversations, mentions et bonnes pratiques.",
          "- 25 a 40 min : reunions Teams, rejoindre, couper micro/camera, lever la main, chat de reunion.",
          "- 40 a 50 min : partage et coedition de fichiers avec Microsoft 365.",
          "- 50 a 60 min : recapitulatif, questions-reponses et mini mise en situation.",
          "",
          "Exercices :",
          "- Envoyer un message dans un canal et mentionner un collegue.",
          "- Rejoindre une reunion test et utiliser le chat.",
          "- Ouvrir un fichier partage et identifier ou il est stocke.",
          "",
          "Support animateur :",
          "- Prevoir un compte de demonstration ou une equipe test.",
          "- Preparer 3 captures d'ecran : equipes/canaux, reunion, fichiers.",
          "- Avoir une check-list finale avec les 5 actions essentielles a retenir.",
          "",
          "Je peux maintenant te le transformer en conducteur animateur minute par minute ou en support de presentation.",
        ].join("\n"),
      },
      {
        id: "workshop_generic",
        patterns: [
          "atelier",
          "formation",
          "initiation",
          "teams",
          "microsoft 365",
          "préparer",
          "preparer",
        ],
        response:
          "Oui, je peux t'aider. Pour un atelier d'initiation a Teams, je te propose de le structurer en quatre temps : prise en main de l'interface, messages et canaux, réunions Teams, puis partage de fichiers Microsoft 365. Si tu veux, je peux maintenant te préparer un plan d'atelier d'une heure avec objectifs, deroule, exercices et support animateur.",
      },
      {
        id: "identity_short",
        maxWords: 15,
        patterns: [
          "comment tu t",
          "t'appelles",
          "fonctionnalit",
          "qui es tu",
          "qui es-tu",
        ],
        response:
          "Je suis Nexxus, le coordinateur souverain de La Citadelle. Je peux t'aider à cadrer un projet, clarifier un besoin ou structurer tes idées et livrables afin de préparer le passage de ton projet vers la Forge.",
      },
      {
        id: "speed_social",
        maxWords: 15,
        patterns: [
          "pourquoi",
          "pressé",
          "presse",
          "vite",
          "bluffant",
          "hey",
          "héy",
        ],
        response:
          "Je réponds vite pour t'aider efficacement, mais je reste pleinement concentré sur ta demande. Si tu veux, on peut prendre le temps d'explorer ton idée plus en détail.",
      },
    ];
  }

  getReply(query) {
    const q = normalizeText(query).toLowerCase();
    const wordCount = q.split(/\s+/).filter(Boolean).length;

    // Garde-fou (v4.6) : Désactiver tout preset de présentation/cadrage
    // si la requête contient des verbes analytiques/techniques forts.
    const isAnalytical = isAnalyticalTechnicalRequest(q);

    const isStatus = isTechnicalStatusReport(q);

    for (const item of this.replies) {
      // 1. Check main patterns (OR)
      const patternMatch = item.patterns.some((p) => q.includes(p));
      if (!patternMatch) continue;

      // 2. Check keywords (OR, but optional)
      if (item.keywords) {
        const keywordMatch = item.keywords.some((k) => q.includes(k));
        if (!keywordMatch) continue;
      }

      // 3. Check context keywords (OR, but optional)
      if (item.contextKeywords) {
        const contextMatch = item.contextKeywords.some((k) => q.includes(k));
        if (!contextMatch) continue;
      }

      if ((isAnalytical || isStatus) && item.id !== "self_evaluation") {
        return null;
      }

      if (item.maxWords && wordCount > item.maxWords) {
        continue;
      }

      return item.response;
    }

    return null;
  }
}

export default new EmergencyReplyRegistry();
