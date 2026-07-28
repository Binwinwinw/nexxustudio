import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { runConversationShortCircuit } from "../src/agent/micro/classifiers/intentShortCircuit.js";
import {
  TECHNICAL_LEARNING_VOCABULARY_BOUNDARIES,
  assertVocabularyBoundaryPair,
} from "./helpers/technicalLearningVocabularyBoundaries.js";

describe("technicalLearningPath — frontières vocabulaire (famille-wide)", () => {
  for (const boundary of TECHNICAL_LEARNING_VOCABULARY_BOUNDARIES) {
    it(`${boundary.id} — ${boundary.intent}`, async () => {
      await assertVocabularyBoundaryPair(
        boundary,
        runConversationShortCircuit,
        assert,
      );
    });
  }
});
