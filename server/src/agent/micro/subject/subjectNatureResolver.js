import { isExploitableProcedureIntent } from "../../utils/procedureIntentGuards.js";
import {
  resolveSubjectIntelligence,
  isProcedureFormWithResolvableSubject,
  extractProcedureTargetSubject,
  looksLikeProperNamePhrase,
  SUBJECT_NATURES,
} from "./subjectIntelligenceLayer.js";
import { buildSubjectInterpretedState } from "./subjectInterpretedState.js";
import { planProcedureIntent, SUBJECT_ROUTER_ACTIONS } from "./subjectIntentRouter.js";
import { buildSubjectClarificationReply } from "./subjectResponseBuilder.js";
import { DETERMINISTIC_ROUTES } from "./subjectRoutingHints.js";
import { buildLauncherGuideReply } from "../replies/launcherGuideBuilder.js";
import { runMiniDeliberation } from "./miniDeliberationGate.js";
import { shouldBlockThinAutoProcedure } from "./subjectDeliberationPolicy.js";
import {
  isForgeProjectScopingQuery,
  buildForgeProjectScopingReply,
  shouldRescueProcedureDraft,
} from "./forgeProjectScoping.js";

export {
  SUBJECT_NATURES,
  extractProcedureTargetSubject,
  looksLikeProperNamePhrase,
  isProcedureFormWithResolvableSubject,
  resolveSubjectIntelligence,
};

export { buildSubjectClarificationReply } from "./subjectResponseBuilder.js";
export { buildSubjectInterpretedState } from "./subjectInterpretedState.js";

export const SUBJECT_NATURE_BEFORE_PROCEDURE_RULE =
  "resolve_subject_nature_before_procedure_reply";

export function resolveSubjectNature(query = "", subject = null, options = {}) {
  return buildSubjectInterpretedState({
    query,
    extractedSubject: subject,
    ...options,
  }).state;
}

/**
 * Gate procédure — consomme état + policy + router ; délibération optionnelle.
 * @param {string} query
 * @param {object} [options]
 */
export async function evaluateProcedureSubjectNatureGate(query = "", options = {}) {
  if (isForgeProjectScopingQuery(query)) {
    const interpreted = buildSubjectInterpretedState({ query, ...options });
    const forgeReply = buildForgeProjectScopingReply(query);
    const deliberation = await runMiniDeliberation({
      query,
      interpreted,
      policy: interpreted.policy,
      autoDraft: forgeReply,
      llmClient: options.llmClient,
      forceForgeScoping: true,
    });
    const reply =
      deliberation.enrichedReply && !shouldRescueProcedureDraft(query, deliberation.enrichedReply)
        ? deliberation.enrichedReply
        : forgeReply;
    return {
      allowProcedure: false,
      path: deliberation.usedLlm
        ? "procedure_subject_mini_deliberation"
        : "forge_project_scoping_ready",
      reply,
      interpreted,
      plan: {
        kind: "forge_project_scoping_ready",
        routeHint: DETERMINISTIC_ROUTES.FORGE_PROJECT_SCOPING_READY,
      },
      deliberation,
      resolution: interpreted.state,
      research: interpreted.research,
      rule: SUBJECT_NATURE_BEFORE_PROCEDURE_RULE,
    };
  }

  const studioProcedure = isExploitableProcedureIntent(query);
  const formWithSubject = isProcedureFormWithResolvableSubject(query);
  if (!studioProcedure && !formWithSubject) {
    return { allowProcedure: true };
  }

  const interpreted = buildSubjectInterpretedState({ query, ...options });
  const plan = planProcedureIntent({
    state: interpreted.state,
    ambiguity: interpreted.ambiguity,
    studioProcedure,
    formWithSubject,
    query,
  });

  if (
    plan.routeHint === DETERMINISTIC_ROUTES.LAUNCHER_GUIDE_BUILDER &&
    plan.action === SUBJECT_ROUTER_ACTIONS.ROUTE_DETERMINISTIC
  ) {
    const launcher = buildLauncherGuideReply(interpreted, plan, { query });
    if (launcher.handled && launcher.reply) {
      return {
        allowProcedure: false,
        path: "launcher_guide_deterministic",
        reply: launcher.reply,
        interpreted,
        plan,
        resolution: interpreted.state,
        research: interpreted.research,
        rule: SUBJECT_NATURE_BEFORE_PROCEDURE_RULE,
        telemetry: launcher.telemetry,
      };
    }
    if (launcher.reply) {
      return {
        allowProcedure: false,
        path: "launcher_guide_clarify",
        reply: launcher.reply,
        interpreted,
        plan,
        resolution: interpreted.state,
        research: interpreted.research,
        rule: SUBJECT_NATURE_BEFORE_PROCEDURE_RULE,
      };
    }
  }

  const autoDraft = buildSubjectClarificationReply(
    interpreted.state,
    interpreted.ambiguity,
    { routeHint: plan.routeHint, query },
  );

  const needsDeliberation =
    shouldBlockThinAutoProcedure(interpreted.policy) ||
    plan.action !== SUBJECT_ROUTER_ACTIONS.ALLOW_PROCEDURE;

  if (needsDeliberation) {
    const deliberation = await runMiniDeliberation({
      query,
      interpreted,
      policy: interpreted.policy,
      autoDraft,
      llmClient: options.llmClient,
    });

    let reply = deliberation.enrichedReply || autoDraft;
    if (shouldRescueProcedureDraft(query, reply)) {
      reply = buildForgeProjectScopingReply(query);
    }
    if (reply) {
      return {
        allowProcedure: false,
        path: deliberation.usedLlm
          ? "procedure_subject_mini_deliberation"
          : "procedure_subject_nature_gate",
        reply,
        interpreted,
        plan,
        deliberation,
        resolution: interpreted.state,
        research: interpreted.research,
        rule: SUBJECT_NATURE_BEFORE_PROCEDURE_RULE,
      };
    }
  }

  if (plan.action === SUBJECT_ROUTER_ACTIONS.ALLOW_PROCEDURE) {
    return {
      allowProcedure: true,
      interpreted,
      plan,
      resolution: interpreted.state,
      research: interpreted.research,
    };
  }

  if (autoDraft) {
    return {
      allowProcedure: false,
      path: "procedure_subject_nature_gate",
      reply: autoDraft,
      interpreted,
      plan,
      resolution: interpreted.state,
      research: interpreted.research,
      rule: SUBJECT_NATURE_BEFORE_PROCEDURE_RULE,
    };
  }

  return { allowProcedure: true, interpreted, plan };
}

/** @deprecated */
export function buildSubjectNatureClarificationReply(resolution = {}) {
  return buildSubjectClarificationReply(resolution);
}
