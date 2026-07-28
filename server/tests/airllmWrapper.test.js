import assert from "node:assert/strict";
import {
  getClientForModel,
  getClientName,
  isHeavyStreamingModel,
} from "../src/llm/llmFactory.js";

function pass(name) {
  console.log(`PASS - ${name}`);
}

async function main() {
  assert.equal(isHeavyStreamingModel("gemma4:26b"), true);
  assert.equal(isHeavyStreamingModel("gemma4:31b"), true);
  assert.equal(isHeavyStreamingModel("granite4.1:30b"), true);
  assert.equal(isHeavyStreamingModel("nemotron3:33b"), true);

  assert.equal(isHeavyStreamingModel("deepseek-r1:14b"), false);
  assert.equal(isHeavyStreamingModel("deepseek-r1:8b"), false);
  assert.equal(isHeavyStreamingModel("qwen3.5:9b"), false);
  assert.equal(isHeavyStreamingModel("ornith:9b"), false);
  assert.equal(isHeavyStreamingModel("starcoder2:15b"), false);
  assert.equal(isHeavyStreamingModel("qwen2.5-coder:7b"), false);
  pass("heavy model detection works");

  assert.equal(getClientName("deepseek-r1:14b"), "ollama");
  assert.equal(getClientName("qwen3.5:9b"), "ollama");
  assert.equal(getClientName("ornith:9b"), "ollama");
  assert.equal(getClientName("qwen2.5-coder:7b"), "ollama");
  pass("client name defaults to ollama when AirLLM is disabled");

  const client = getClientForModel("deepseek-r1:14b");
  assert.equal(typeof client.ensureModel, "function");
  assert.equal(typeof client.chatStream, "function");
  pass("getClientForModel returns a valid client interface");

  console.log("All AirLLM wrapper tests passed.");
}

main().catch((error) => {
  console.error("AirLLM wrapper test failure:", error.message);
  process.exitCode = 1;
});
