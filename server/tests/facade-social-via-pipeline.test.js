import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import agent from "../src/agent/agent.js";
import AgentPipeline from "../src/agent/agentPipeline.js";

const AGENT_SRC = readFileSync(
  new URL("../src/agent/agent.js", import.meta.url),
  "utf8",
);

describe("FAÇADE_SOCIAL_VIA_PIPELINE_V1", () => {
  it("agent.js n'injecte plus de table sociale et n'invente pas la reply", () => {
    assert.doesNotMatch(
      AGENT_SRC,
      /getDeterministicSocialResponse:\s*\n\s*this\.getDeterministicSocialResponse/,
    );
    assert.doesNotMatch(AGENT_SRC, /exactGreetings/);
    assert.doesNotMatch(AGENT_SRC, /Si tu veux on peut papoter/);
    assert.match(AGENT_SRC, /return this\.pipeline\.run\(/);
  });

  it("pipeline possède le social ; façade délègue seulement", () => {
    const pipeline = new AgentPipeline({ maxIterations: 1 });
    const salut = pipeline.getDeterministicSocialResponse("salut");
    assert.match(salut, /papoter/i);
    assert.equal(
      pipeline.getDeterministicSocialResponse("salut, analyse ce repo"),
      undefined,
    );
    assert.equal(agent.getDeterministicSocialResponse("salut"), salut);
    assert.equal(
      new AgentPipeline({
        maxIterations: 1,
        getDeterministicSocialResponse: () => null,
      }).getDeterministicSocialResponse("salut"),
      null,
    );
  });
});
