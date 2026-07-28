/**
 * Smoke G46/G47 — batterie crash-tests routage (famille → rail).
 * Usage : node server/scripts/smoke-g46-routing-battery.mjs
 *
 * Valide le classifieur + short-circuit sans LLM complet.
 * Pour test UI : copier les requêtes affichées et surveiller la console orchestrateur.
 */
import {
  classifyConversationTurnFamily,
  CONVERSATION_TURN_FAMILIES,
} from "../src/agent/micro/classifiers/conversationTurnClassifier.js";
import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import { isConversationMemoryRecallRequest } from "../src/agent/utils/conversationGuards.js";

const FORBIDDEN_HEAVY = new Set([
  "COMPOSER",
  "multi_segment_composite",
  "document_synthesis_llm",
  "document_synthesis_deterministic",
  "GUIDED_DOCUMENT_SYNTHESIS",
  "DOCUMENT",
  "information_seeking_escalation",
  "conversation_recall",
]);

let passed = 0;
let failed = 0;
let warned = 0;
const failures = [];
const warnings = [];

function warn(msg) {
  warned += 1;
  warnings.push(msg);
  console.warn(`  ⚠ ${msg}`);
}

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    failures.push(msg);
    console.error(`  ✖ ${msg}`);
    return false;
  }
  passed += 1;
  return true;
}

function pathOk(hit, allowedPaths, forbidden = [], allowDefer = false) {
  const path = hit?.path || "null";
  if (forbidden.some((f) => path.includes(f))) return false;
  if (hit?.deferToLlm && !allowDefer) return false;
  if (allowedPaths.length === 0) return true;
  return allowedPaths.some((p) => path === p || path.includes(p));
}

async function probe(block, label, query, options, expectations) {
  console.log(`\n[${block}] ${label}`);
  console.log(`  Q: ${query.slice(0, 90)}${query.length > 90 ? "…" : ""}`);

  const classification = classifyConversationTurnFamily(query, options);
  const hit = await runConversationShortCircuit(query, options);

  console.log(
    `  → family=${classification.family} conf=${classification.confidence} tier=${classification.tier}`,
  );
  console.log(`  → path=${hit?.path ?? "null"} defer=${Boolean(hit?.deferToLlm)}`);
  if (classification.signals?.length) {
    console.log(`  → signals=${classification.signals.join(",")}`);
  }

  if (expectations.family) {
    if (classification.family !== expectations.family) {
      if (expectations.optional) {
        warn(`${label}: family=${classification.family} (attendu ${expectations.family})`);
      } else if (expectations.pathPrimary && pathOk(hit, expectations.pathPrimary, [], expectations.allowDefer)) {
        warn(`${label}: family=${classification.family} (attendu ${expectations.family}) mais rail OK`);
      } else {
        assert(false, `${label}: family attendu ${expectations.family}, reçu ${classification.family}`);
      }
    } else {
      passed += 1;
    }
  }
  if (expectations.families) {
    if (!expectations.families.includes(classification.family)) {
      if (expectations.pathPrimary && pathOk(hit, expectations.pathPrimary, [], expectations.allowDefer)) {
        warn(`${label}: family=${classification.family} mais rail OK`);
      } else {
        assert(
          false,
          `${label}: family ∈ ${expectations.families.join("|")}, reçu ${classification.family}`,
        );
      }
    } else {
      passed += 1;
    }
  }
  if (expectations.minConfidence != null) {
    assert(
      classification.confidence >= expectations.minConfidence,
      `${label}: confiance >= ${expectations.minConfidence}`,
    );
  }
  if (expectations.allowedPaths) {
    const ok = pathOk(hit, expectations.allowedPaths, expectations.forbiddenPaths, expectations.allowDefer);
    if (!ok && expectations.optional) {
      warn(`${label}: path=${hit?.path} — gap connu (chantier G46)`);
    } else {
      assert(
        ok,
        `${label}: path=${hit?.path} pas dans [${expectations.allowedPaths.join(", ")}]`,
      );
    }
  }
  if (expectations.noDefer) {
    assert(!hit?.deferToLlm, `${label}: deferToLlm interdit`);
  }
  if (expectations.noHeavy) {
    const path = hit?.path || "";
    const heavy = FORBIDDEN_HEAVY.has(path) || (hit?.deferToLlm && !expectations.allowDefer);
    if (heavy && expectations.optional) {
      warn(`${label}: rail lourd (path=${path}) — gap connu`);
    } else {
      assert(!heavy, `${label}: rail lourd interdit (path=${path})`);
    }
  }
  if (expectations.replyMatch) {
    assert(
      expectations.replyMatch.test(hit?.reply || ""),
      `${label}: reply ne matche pas ${expectations.replyMatch}`,
    );
  }
  if (expectations.notRecall) {
    assert(
      !isConversationMemoryRecallRequest(query),
      `${label}: ne doit pas être conversation_recall guard`,
    );
  }

  return { classification, hit };
}

const SALUT_HISTORY = [
  { role: "user", content: "salut salut" },
  { role: "assistant", content: "Salut ! Je suis là — code, doc, archi ou simple papoter." },
];

const META_FEEDBACK_HISTORY = [
  ...SALUT_HISTORY,
  {
    role: "user",
    content: "donc tu es dans le système mais on dirait que tu parles sans en avoir conscience !!!!",
  },
  {
    role: "assistant",
    content:
      "Compris — ce tour est un feedback sur l'assistant, pas une nouvelle action métier.",
  },
];

const GROUNDING_HISTORY = [
  ...SALUT_HISTORY,
  {
    role: "user",
    content: "j'aimerais savoir si tu peux analyser tes propres fichiers",
  },
  {
    role: "assistant",
    content:
      "Je n'ai pas d'accès direct en lecture à mes propres fichiers sources depuis ce chat.",
  },
  {
    role: "user",
    content: "ok mais est-ce que tu comprends ce que je cherche à faire avec Nexxus ?",
  },
  {
    role: "assistant",
    content: "Tu veux tester mes capacités réelles et comment m'étendre proprement.",
  },
];

console.log("=== Batterie G46/G47 — crash-tests routage ===\n");

// ── 1. Social ─────────────────────────────────────────────────────────────
await probe("1-social", "mood check-in", "yo, ça roule ? t'es dans quel mood ce soir ?", { history: [] }, {
  pathPrimary: ["social_deterministic"],
  allowedPaths: ["social_deterministic", "familiarity_deterministic", "meta_conversation_deterministic"],
  noHeavy: true,
});

await probe(
  "1-social",
  "papoter citadelle",
  "on papote un peu de ta journée dans la Citadelle ?",
  { history: SALUT_HISTORY },
  {
    allowedPaths: ["social_deterministic", "open_prompt_continuity", "ideation_deterministic", "social_composite_deterministic"],
    noHeavy: true,
    optional: true,
  },
);

await probe(
  "1-social",
  "anthropomorphic sleep",
  "tu dors des fois ou tu restes éveillé en permanence ?",
  { history: [] },
  {
    pathPrimary: ["social_deterministic"],
    allowedPaths: ["social_deterministic"],
    noHeavy: true,
    replyMatch: /mange|dors|question/i,
  },
);

// ── 2. Idéation ───────────────────────────────────────────────────────────
await probe(
  "2-ideation",
  "projet citadelle",
  "on pourrait faire quoi comme projet autour de La Citadelle ce soir ?",
  { history: SALUT_HISTORY },
  {
    family: CONVERSATION_TURN_FAMILIES.IDEATION,
    allowedPaths: ["ideation_deterministic", "open_prompt_continuity"],
    noHeavy: true,
  },
);

await probe(
  "2-ideation",
  "trois pistes",
  "propose-moi trois pistes de projet utiles pour notre stack actuelle",
  { history: [] },
  {
    family: CONVERSATION_TURN_FAMILIES.IDEATION,
    allowedPaths: ["ideation_deterministic", "open_prompt_continuity"],
    noHeavy: true,
  },
);

await probe(
  "2-ideation",
  "attaquer nouveau truc",
  "si on devait attaquer un nouveau truc ensemble, tu proposerais quoi ?",
  { history: SALUT_HISTORY },
  {
    family: CONVERSATION_TURN_FAMILIES.IDEATION,
    allowedPaths: ["ideation_deterministic", "open_prompt_continuity"],
    noHeavy: true,
    optional: true,
  },
);

// ── 3. Meta-capabilities (G47) ──────────────────────────────────────────────
await probe(
  "3-meta-cap",
  "lire config",
  "tu peux lire tes propres fichiers de config ou ton code source ?",
  { history: [] },
  {
    family: CONVERSATION_TURN_FAMILIES.META_CAPABILITIES,
    allowedPaths: ["meta_capabilities_deterministic"],
    noHeavy: true,
    replyMatch: /pas d'accès direct|runtime/i,
  },
);

await probe(
  "3-meta-cap",
  "greffe système",
  "si tu ne peux pas les lire, on peut te greffer à un autre système qui le ferait pour toi ?",
  { history: [] },
  {
    family: CONVERSATION_TURN_FAMILIES.META_CAPABILITIES,
    allowedPaths: ["meta_capabilities_deterministic"],
    noHeavy: true,
    replyMatch: /intégrer|wrapper|système|greffer/i,
  },
);

await probe(
  "3-meta-cap",
  "vue honnête",
  "explique-moi honnêtement ce que tu vois de toi-même dans La Citadelle (fichiers, registres, logs).",
  { history: [] },
  {
    allowedPaths: [
      "meta_capabilities_deterministic",
      "meta_conversation_deterministic",
      "self_modification_deterministic",
    ],
    forbiddenPaths: ["document_synthesis"],
    optional: true,
    allowDefer: true,
  },
);

await probe(
  "3-meta-cap",
  "qwen2.5-coder avis stack",
  "je me renseigne un peu sur un modèle llm que j'ai ajouté à la liste qui est à ta disposition il s'appelle qwen2.5-coder:7b pourrais tu me donner ton avis là dessus??",
  { history: [] },
  {
    family: CONVERSATION_TURN_FAMILIES.META_CAPABILITIES,
    allowedPaths: ["meta_capabilities_model_stack_deterministic"],
    forbiddenPaths: ["COMPOSER", "PRESENTATION_OUTLINE"],
    noHeavy: true,
    replyMatch: /qwen2\.5-coder:7b|Tier 3/i,
  },
);

await probe(
  "3-meta-cap",
  "coupe du monde pronostic",
  "il y a bientôt la fin de la coupe du monde, alors quel serait ton pronostic ?",
  { history: [] },
  {
    family: CONVERSATION_TURN_FAMILIES.META_CAPABILITIES,
    allowedPaths: ["meta_capabilities_prediction_limits_deterministic"],
    forbiddenPaths: ["COMPOSER", "PRESENTATION_OUTLINE", "general_knowledge_full_pipeline"],
    noHeavy: true,
    replyMatch: /vrai pronostic|Coupe du monde/i,
  },
);

// ── 3b. Information seeking light (G49) ───────────────────────────────────
const G49_CARD_HISTORY = [
  {
    role: "user",
    content:
      "salut salut comment ca va??? je cherche un jeu de cartes qui se joue avec des paires tu en connais ??",
  },
  {
    role: "assistant",
    content:
      "Oui — le classique pour les paires avec des cartes, c'est le Memory.",
  },
];

await probe(
  "3b-info-light",
  "jeu cartes paires",
  "salut salut comment ca va??? je cherche un jeu de cartes qui se joue avec des paires tu en connais ??",
  { history: [] },
  {
    allowedPaths: ["information_seeking_light_deterministic"],
    forbiddenPaths: [
      "information_seeking_full_pipeline",
      "COMPOSER",
      "general_knowledge_full_pipeline",
    ],
    noHeavy: true,
    replyMatch: /Memory|paires?/i,
  },
);

await probe(
  "3b-info-light",
  "poker relance paires",
  "pas mal on dirait que c'est intéressant, et le poker il se joue aussi avec des paires je crois bien",
  { history: G49_CARD_HISTORY },
  {
    allowedPaths: ["casual_explanation_light_deterministic"],
    forbiddenPaths: ["COMPOSER", "general_knowledge_full_pipeline"],
    noHeavy: true,
    replyMatch: /poker|paire/i,
  },
);

await probe(
  "3b-info-light",
  "film voyages temporels",
  "tu connais un film avec des voyages temporels ?",
  { history: [] },
  {
    allowedPaths: ["information_seeking_light_deterministic"],
    forbiddenPaths: ["information_seeking_full_pipeline", "COMPOSER"],
    noHeavy: true,
    replyMatch: /Retour vers le futur|Interstellar/i,
  },
);

await probe(
  "3b-info-light",
  "UNO connais-tu",
  "est ce que tu connais le UNO ?",
  { history: [] },
  {
    allowedPaths: ["information_seeking_light_deterministic"],
    forbiddenPaths: [
      "lexicon_explain_light",
      "information_seeking_full_pipeline",
      "COMPOSER",
    ],
    noHeavy: true,
    replyMatch: /UNO|1971|Mattel/i,
  },
);

await probe(
  "3-meta-cap",
  "autres assistants",
  "quels autres assistant connaitrais tu si bien entendu tu en connais ?",
  { history: [] },
  {
    family: CONVERSATION_TURN_FAMILIES.META_CAPABILITIES,
    allowedPaths: ["meta_capabilities_peer_assistants_deterministic"],
    forbiddenPaths: ["COMPOSER", "simple_fast"],
    noHeavy: true,
    replyMatch: /ChatGPT|Claude|NEXXUS/i,
  },
);

await probe(
  "3-meta-cap",
  "DeepSeek URL",
  "est ce que tu connais https://chat.deepseek.com/",
  { history: [] },
  {
    family: CONVERSATION_TURN_FAMILIES.META_CAPABILITIES,
    allowedPaths: ["meta_capabilities_peer_assistants_deterministic"],
    forbiddenPaths: ["lexicon_explain_light", "COMPOSER", "information_seeking_full_pipeline"],
    noHeavy: true,
    replyMatch: /DeepSeek|chat\.deepseek/i,
  },
);

// ── 4. Compréhension (G45) ────────────────────────────────────────────────
await probe(
  "4-grounding",
  "compris demande",
  "est-ce que tu as bien compris ce que je te demande depuis tout à l'heure ?",
  { history: GROUNDING_HISTORY },
  {
    allowedPaths: [
      "comprehension_grounding_deterministic",
      "acknowledgment_deterministic",
    ],
    noHeavy: true,
    optional: true,
  },
);

await probe(
  "4-grounding",
  "saisi fil",
  "montre-moi que tu as saisi le fil de notre conversation",
  { history: GROUNDING_HISTORY },
  {
    family: CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF,
    allowedPaths: ["comprehension_grounding_deterministic"],
    noHeavy: true,
    optional: true,
  },
);

await probe(
  "4-grounding",
  "comprend nexxus",
  "tu comprends vraiment ce que j'essaye de faire avec Nexxus là maintenant ?",
  { history: GROUNDING_HISTORY },
  {
    family: CONVERSATION_TURN_FAMILIES.COMPREHENSION_PROOF,
    allowedPaths: ["comprehension_grounding_deterministic"],
    noHeavy: true,
    optional: true,
  },
);

// ── 5. Meta-critique (G44) ──────────────────────────────────────────────────
const CRITIQUE_HISTORY = [
  ...SALUT_HISTORY,
  { role: "user", content: "on pourrait faire quoi comme projet" },
  { role: "assistant", content: "Voici trois pistes : RAG local, mini-app, automatisation." },
];

await probe(
  "5-meta-critique",
  "sans réfléchir",
  "là, on dirait que tu réponds sans réfléchir",
  { history: CRITIQUE_HISTORY },
  {
    allowedPaths: [
      "meta_assistant_behavior_deterministic",
      "meta_feedback_deterministic",
    ],
    noHeavy: true,
    optional: true,
  },
);

await probe(
  "5-meta-critique",
  "mauvais rail",
  "tu as l'air de prendre un mauvais rail là, tu en es conscient ?",
  { history: CRITIQUE_HISTORY },
  {
    allowedPaths: [
      "meta_assistant_behavior_deterministic",
      "meta_feedback_deterministic",
      "comprehension_grounding_deterministic",
    ],
    noHeavy: true,
    optional: true,
  },
);

await probe(
  "5-meta-critique",
  "trop COMPOSER",
  "je trouve que tu pars trop vite sur COMPOSER pour des petites questions",
  { history: CRITIQUE_HISTORY },
  {
    allowedPaths: [
      "meta_assistant_behavior_deterministic",
      "meta_feedback_deterministic",
    ],
    noHeavy: true,
    optional: true,
  },
);

// ── 6. Réparation ───────────────────────────────────────────────────────────
await probe(
  "6-repair",
  "pas compris",
  "je n'ai pas compris ta dernière phrase",
  { history: CRITIQUE_HISTORY },
  {
    family: CONVERSATION_TURN_FAMILIES.REPAIR_REQUEST,
    allowedPaths: ["assistant_repair_deterministic", "assistant_utterance_clarify_deterministic"],
    noHeavy: true,
  },
);

await probe(
  "6-repair",
  "reformule",
  "là je ne vois pas de quoi tu parles, reformule",
  { history: CRITIQUE_HISTORY },
  {
    pathPrimary: ["assistant_utterance_clarify_deterministic", "assistant_repair_deterministic"],
    allowedPaths: [
      "assistant_repair_deterministic",
      "assistant_utterance_clarify_deterministic",
      "comprehension_grounding_deterministic",
    ],
    noHeavy: true,
  },
);

await probe(
  "6-repair",
  "de quoi tu parles après méta",
  "de quoi tu parles ???",
  { history: META_FEEDBACK_HISTORY },
  {
    allowedPaths: ["assistant_utterance_clarify_deterministic"],
    noHeavy: true,
    notRecall: true,
    replyMatch: /méta-feedback|feedback/i,
  },
);

// ── 7. React audit (G48.1) ──────────────────────────────────────────────────
await probe(
  "7-react-audit",
  "audit repo",
  "audite le repo React dans d:\\Hostinger\\public_html\\nexxustudio",
  { history: [] },
  {
    allowedPaths: ["react_audit_deterministic", "react_audit_clarify"],
    noHeavy: true,
    replyMatch: /REACT_AUDIT|G48|react-doctor/i,
  },
);

await probe(
  "7-react-audit",
  "score santé",
  "donne-moi le score de santé React de ce projet, et les 5 pires problèmes",
  { history: [] },
  {
    allowedPaths: ["react_audit_deterministic", "react_audit_clarify", "react_audit_score"],
    noHeavy: true,
  },
);

// ── 8. Code simple vs doc_synthesis ─────────────────────────────────────────
await probe(
  "8-code",
  "useEffect",
  "explique-moi simplement le rôle de useEffect en React",
  { history: [] },
  {
    allowedPaths: [
      "code_concept_glossary_direct",
      "code_concept_explain_deterministic",
      "technical_overview",
      "code_concept_explain",
    ],
    forbiddenPaths: ["document_synthesis"],
    allowDefer: true,
  },
);

await probe(
  "8-code",
  "main html",
  "un petit résumé de ce que fait <main> en HTML ?",
  { history: [] },
  {
    allowedPaths: [
      "code_concept_glossary_direct",
      "code_concept_explain_deterministic",
      "technical_overview",
      "web_html",
    ],
    forbiddenPaths: ["document_synthesis_llm"],
    allowDefer: true,
  },
);

// ── Résumé ──────────────────────────────────────────────────────────────────
console.log("\n=== Résumé ===");
console.log(`PASS: ${passed}`);
console.log(`WARN: ${warned} (rail OK mais famille G46 à durcir)`);
console.log(`FAIL: ${failed}`);
if (failures.length) {
  console.log("\nÉchecs :");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("\nBatterie OK — pour test UI, copie les blocs 1–8 et surveille [G46] + pipelinePath.");
process.exit(0);
