import AgentPipeline from "./agentPipeline.js";
import { runPipeline } from "./orchestrator/runPipeline.js";
import { isTechnicalStatusReport } from "./utils/conversationGuards.js";
import { getIdentityDeterministicReply } from "./utils/identityIntentGuards.js";
import {
  buildParseState,
  evaluateAutoReplySufficiency,
} from "./micro/parsing/responseSufficiencyEvaluator.js";
import { resolveMultiSegmentPlan } from "./micro/parsing/multiSegmentResponsePlan.js";

class Agent {
  constructor() {
    this.maxIterations = 5;
    this.pipeline = new AgentPipeline({
      maxIterations: this.maxIterations,
      getDeterministicSocialResponse:
        this.getDeterministicSocialResponse.bind(this),
    });
  }

  getDeterministicSocialResponse(q) {
    const cleanQ = q
      .toLowerCase()
      .replace(/[?!.]+$/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    const normalizedQ = cleanQ.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const parseState = buildParseState(q);
    const segmentPlan = resolveMultiSegmentPlan(q);
    if (segmentPlan.shouldDeferToPipeline) {
      return null;
    }
    if (segmentPlan.signalOnly && segmentPlan.preamble) {
      return segmentPlan.preamble;
    }

    const asksAgentArchitecture =
      !isTechnicalStatusReport(cleanQ) &&
      /(citadelle|nexxus)/.test(normalizedQ) &&
      /(agent|orchestrat|sous-agent|sous agent|forge)/.test(normalizedQ) &&
      /(y a|il y a|est-ce que|c est quoi|comment|structure|architecture)/.test(
        normalizedQ,
      );
    if (asksAgentArchitecture) {
      const archReply =
        "Oui. La Citadelle utilise un agent principal d'orchestration et des agents specialises. L'agent principal coordonne, les agents specialises executent des taches ciblees, et la Forge est le sous-systeme technique de production et transformation.";
      const archSufficiency = evaluateAutoReplySufficiency({
        query: q,
        detectedSignal: "architecture_fact",
        parseState,
        candidateReply: archReply,
      });
      if (!archSufficiency.sufficient) return null;
      return archReply;
    }

    // Doctrine de Sécurité Épistémique : l'intention métier doit TOUJOURS écraser la salutation
    const technicalMarkers = [
      // Conceptuels & Organisationnels
      "projet",
      "forge",
      "atelier",
      "formation",
      "initiation",
      "teams",
      "microsoft 365",
      "application",
      "appli",
      "plan",
      "objectifs",
      "deroule",
      "déroulé",
      "exercices",
      "support",
      "animateur",
      "code",
      "build",
      "architecture",
      "fonctionnalite",
      "fonctionnalités",
      "expert",
      "studio",

      // Objets techniques / cibles métier
      "dossier",
      "fichier",
      "repo",
      "document",
      "doc",
      "chemin",
      "path",
      "base",
      "bdd",
      "database",
      "log",

      // Verbes d'action (stems linguistiques)
      "index",
      "analys",
      "corrig",
      "amélio",
      "amélior",
      "amelio",
      "amelior",
      "refactor",
      "lire",
      "creer",
      "créer",
      "cree",
      "crée",
      "gener",
      "génér",
      "audit",
      "scann",
      "compar",
      "cherch",

      // Formulations de requêtes opérationnelles
      "peux-tu",
      "peux tu",
      "pourrais-tu",
      "pourrais tu",
      "besoin que",
      "analyse ceci",
      "prends ce",
    ];

    const hasTechnicalIntent = technicalMarkers.some((marker) =>
      cleanQ.includes(marker),
    );
    if (hasTechnicalIntent) {
      return undefined; // Délégation immédiate au pipeline normal (social_plus_task)
    }

    const exactGreetings = {
      salut:
        "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      "salut salut":
        "Salut ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      bonjour:
        "Bonjour ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      hello:
        "Bonjour ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      coucou:
        "Coucou ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
      "ça va": "Oui, tout va bien ici. Comment puis-je t'aider ?",
      "ca va": "Oui, tout va bien ici. Comment puis-je t'aider ?",
      "comment vas tu":
        "Tout va bien ici. Comment puis-je t'aider aujourd'hui ?",
      "comment vas-tu":
        "Tout va bien ici. Comment puis-je t'aider aujourd'hui ?",
      "bonjour comment vas tu":
        "Bonjour ! Tout va bien ici. Comment puis-je t'aider aujourd'hui ?",
      "bonjour comment vas-tu":
        "Bonjour ! Tout va bien ici. Comment puis-je t'aider aujourd'hui ?",
      "salut ça va":
        "Salut ! Tout va bien ici. Quelle est la mission du jour ?",
      "salut ca va":
        "Salut ! Tout va bien ici. Quelle est la mission du jour ?",
      "salut salut comment vas tu":
        "Bonjour ! Tout va bien ici. Que faisons-nous aujourd'hui ?",
    };

    const wordCount = cleanQ.split(/\s+/).filter(Boolean).length;

    // Si le message est trop long, il contient probablement plus qu'une simple salutation.
    // On passe directement à l'orchestrateur.
    if (wordCount > 15) {
      return undefined;
    }

    if (exactGreetings[cleanQ]) {
      return exactGreetings[cleanQ];
    }

    const weightedPatterns = [
      {
        response:
          "Je réponds rapidement pour t'aider efficacement, et ma réponse reste pleinement concentrée sur ta demande. Si tu veux, on peut prendre le temps d'explorer ton idée plus en détail.",
        keywords: [
          ["hey", 1],
          ["héy", 1],
          ["pourquoi", 1],
          ["pressé", 2],
          ["presse", 2],
          ["vite", 1],
          ["bluffant", 2],
        ],
        threshold: 3,
      },
      {
        response:
          "Bonjour ! Si tu veux on peut papoter ou je t'aide à cadrer un projet, clarifier un besoin, structurer des livrables. Qu'est-ce que tu veux faire ?",
        keywords: [
          ["bonjour", 3],
          ["salut", 3],
          ["hello", 3],
          ["coucou", 3],
          ["yop", 2],
          ["yo", 1],
          ["comment", 1],
          ["vas", 1],
          ["va", 1],
          ["dedans", 0.5],
        ],
        threshold: 3.5,
      },
    ];

    const identityReply = getIdentityDeterministicReply(q);
    if (identityReply) {
      return identityReply;
    }

    for (const pattern of weightedPatterns) {
      const score = pattern.keywords.reduce((total, [keyword, weight]) => {
        const isShort = keyword.length <= 3;
        const matched = isShort
          ? new RegExp(`\\b${keyword}\\b`, "i").test(cleanQ)
          : cleanQ.includes(keyword);
        return total + (matched ? weight : 0);
      }, 0);

      if (score >= pattern.threshold) {
        return pattern.response;
      }
    }

    // Check for "deep" social or activity-related questions that deserve LLM attention
    const activityMarkers = [
      "fais",
      "prévu",
      "programme",
      "occupe",
      "penses",
      "crois",
      "avis",
    ];
    const isDeepQuery =
      activityMarkers.some((m) => cleanQ.includes(m)) ||
      cleanQ.split(" ").length > 8;

    if (isDeepQuery) {
      return undefined; // Let the LLM handle complex social interactions
    }

    return undefined;
  }

  async run(
    query,
    history = [],
    {
      onStep,
      onContent,
      onThought,
      forcedExpertKey,
      projectState,
      disableRecentMemory,
      ...options
    } = {},
  ) {
    const q = query.toLowerCase().trim();
    if (q.startsWith("diagnostic:") || q.startsWith("audit:")) {
      if (onStep)
        onStep("🔍 Lancement du pipeline épistémique anti-hallucination...");

      const envelope = {
        query_id: `qry_${Date.now()}`,
        user_query: query,
        context: {
          projectState,
          time_utc: new Date().toISOString(),
        },
        constraints: {
          max_tool_calls: 5,
          allow_web: false,
          allow_db: true,
          allow_code: true,
          allow_logs: true,
        },
      };

      const result = await runPipeline(envelope);

      let formattedText = `## Résultat du Diagnostic\n\n${result.response_text}\n\n`;
      if (result.verdict_matrix) {
        if (
          result.verdict_matrix.confirmed &&
          result.verdict_matrix.confirmed.length > 0
        ) {
          formattedText += `### ✅ Faits Confirmés\n- ${result.verdict_matrix.confirmed.join("\n- ")}\n\n`;
        }
        if (
          result.verdict_matrix.probable &&
          result.verdict_matrix.probable.length > 0
        ) {
          formattedText += `### 🧐 Hypothèses Probables\n- ${result.verdict_matrix.probable.join("\n- ")}\n\n`;
        }
        if (
          result.verdict_matrix.unknown &&
          result.verdict_matrix.unknown.length > 0
        ) {
          formattedText += `### ❓ Inconnus\n- ${result.verdict_matrix.unknown.join("\n- ")}\n`;
        }
      }

      if (onContent) onContent(formattedText);
      return formattedText;
    }

    return this.pipeline.run(query, history, {
      onStep,
      onContent,
      onThought,
      forcedExpertKey,
      projectState,
      disableRecentMemory,
      ...options,
    });
  }
}

export default new Agent();
