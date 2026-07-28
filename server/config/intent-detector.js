// server/config/intent-detector.js
import {
  evaluateJustIntent,
} from "../src/agent/policies/justIntentDetectionPolicy.js";

const CONFIDENCE_SCORE = Object.freeze({
  high: 0.85,
  medium: 0.7,
  low: 0.5,
});

const INTENT_BY_SIGNAL = Object.freeze({
  "domain:code": "code/create",
  "domain:presentation": "presentation/plan",
});

export async function justIntentDetection(query = "") {
  const evaluation = evaluateJustIntent(query);
  const intent =
    evaluation.signals
      ?.map((signal) => INTENT_BY_SIGNAL[signal])
      .find(Boolean) || "general/explain";

  return {
    intent,
    conf: CONFIDENCE_SCORE[evaluation.confidence] ?? 0.5,
    evaluation,
  };
}
