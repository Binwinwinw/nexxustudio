import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  extractConversationSubject,
  extractTemporalTarget,
  hasSecondaryActionVerb,
  surfaceMentionsSubject,
  scoreSubjectSurfaceAlignment,
  fuzzyTokenSimilarity,
  parseRelativeDayOffset,
  TEMPORAL_TARGET_KIND,
  ANCHOR_ALIGNMENT_TIER,
} from "../src/agent/policies/conversation/conversationSubjectExtraction.js";
import {
  assessInformationSeekingSubjectAlignment,
  isInformationSeekingContractViolation,
} from "../src/agent/policies/informationSeekingQualificationPolicy.js";

const KING_QUERY = "quelles informations aurais tu du jeu kingofavalon";
const JUNE_1980 = "pourrais tu trouver quel jour était le 19 juin 1980 ???";
const RELATIVE_3_DAYS = "quel jour sera dans 3 jours";
const GPU_DATE =
  "pourrais tu trouver quelle date nous sommes afin de trouver quelle carte graphique 8Go serait un bon achat ??";

describe("conversationSubjectExtraction — entité", () => {
  it("extrait kingofavalon depuis information_seeking", () => {
    const subject = extractConversationSubject(KING_QUERY);
    assert.ok(subject);
    assert.match(subject, /kingofavalon/i);
  });

  it("surfaceMentionsSubject — token ou variante proche", () => {
    assert.equal(
      surfaceMentionsSubject(
        "King of Avalon est un jeu de stratégie mobile.",
        "kingofavalon",
      ),
      true,
    );
    assert.equal(
      surfaceMentionsSubject("Bonjour, comment puis-je t'aider ?", "kingofavalon"),
      false,
    );
  });
});

describe("conversationSubjectExtraction — G20 fuzzy alignment", () => {
  it("scoreSubjectSurfaceAlignment — compact King of Avalon", () => {
    const hit = scoreSubjectSurfaceAlignment(
      "King of Avalon est un jeu de stratégie mobile.",
      "kingofavalon",
    );
    assert.equal(hit.tier, ANCHOR_ALIGNMENT_TIER.STRONG);
    assert.ok(hit.score >= 0.92);
    assert.ok(hit.signals.includes("compact") || hit.signals.includes("exact"));
  });

  it("fuzzyTokenSimilarity — typo légère tolérée", () => {
    const sim = fuzzyTokenSimilarity("kingofavalon", "kingofavalonn");
    assert.ok(sim >= 0.9);
  });

  it("scoreSubjectSurfaceAlignment — typo surface tolérée", () => {
    const hit = scoreSubjectSurfaceAlignment(
      "King of Avalonn est un MMORTPG mobile populaire avec des alliances.",
      "kingofavalon",
    );
    assert.notEqual(hit.tier, ANCHOR_ALIGNMENT_TIER.MISS);
  });

  it("assessInformationSeekingSubjectAlignment — paraphrase G17 non violation", () => {
    const KING_QUERY = "quelles informations aurais tu du jeu kingofavalon";
    const body =
      "King of Avalon est un jeu de stratégie mobile où tu construis ta cité et tes armées.";
    const alignment = assessInformationSeekingSubjectAlignment(body, KING_QUERY);
    assert.equal(alignment.tier, ANCHOR_ALIGNMENT_TIER.STRONG);
    assert.equal(isInformationSeekingContractViolation(body, KING_QUERY), false);
  });
});

describe("conversationSubjectExtraction — temporel", () => {
  it("19 juin 1980 → historical", () => {
    assert.equal(extractTemporalTarget(JUNE_1980), TEMPORAL_TARGET_KIND.HISTORICAL);
  });

  it("dans 3 jours → relative", () => {
    assert.equal(extractTemporalTarget(RELATIVE_3_DAYS), TEMPORAL_TARGET_KIND.RELATIVE);
    assert.equal(parseRelativeDayOffset(RELATIVE_3_DAYS), 3);
  });

  it("nous sommes quel jour → now", () => {
    assert.equal(
      extractTemporalTarget("nous sommes quel jour"),
      TEMPORAL_TARGET_KIND.NOW,
    );
  });
});

describe("conversationSubjectExtraction — verbes secondaires", () => {
  it("trouver dans requête polie", () => {
    assert.equal(hasSecondaryActionVerb(JUNE_1980), true);
    assert.equal(hasSecondaryActionVerb(GPU_DATE), true);
  });
});
