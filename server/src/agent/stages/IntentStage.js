/* server/src/agent/stages/IntentStage.js */
import intentClassifier from "../utils/intentClassifier.js";
import turnTelemetry from "../telemetry/turnTelemetry.js";
import { OTEL_ATTRIBUTES, SPAN_NAMES } from "../telemetry/otelSemanticMap.js";

export class IntentStage {
  static async run(query, { onStep, getDeterministicSocialResponse }) {
    const q = query.toLowerCase().trim();

    turnTelemetry.startSpan(SPAN_NAMES.INTENT);
    const { intent, budget, bypassDirectAnswer } =
      intentClassifier.classifyIntent(query);
    turnTelemetry.endSpan(SPAN_NAMES.INTENT, {
      [OTEL_ATTRIBUTES.INTENT]: intent,
      [OTEL_ATTRIBUTES.REASONING_BUDGET]: budget,
      bypassDirectAnswer,
    });

    const isSocial =
      intent === intentClassifier.INTENT_TAXONOMY.COURTESY ||
      intent === intentClassifier.INTENT_TAXONOMY.SOCIAL;
    const deterministic = getDeterministicSocialResponse
      ? getDeterministicSocialResponse(q)
      : null;

    if (onStep && !isSocial && !deterministic) {
      onStep(
        `📍 Classe d'intention : ${intent.toUpperCase()} (Budget: ${budget})`,
      );
    }

    return { intent, budget, bypassDirectAnswer, isSocial, deterministic };
  }
}
