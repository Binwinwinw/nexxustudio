import { describe, it, expect, vi, beforeEach } from "vitest";
import { finalRendererAgent } from "../src/agent/agents/finalRendererAgent.js";
import { getClientForModel } from "../src/llm/llmFactory.js";

vi.mock("../src/llm/llmFactory.js", () => ({
  getClientForModel: vi.fn(),
}));

describe("Final Renderer Agent - Micro-contract behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should prioritize user micro-contract in CODE_DELIVERY_V1", async () => {
    let capturedUserPrompt = "";

    getClientForModel.mockReturnValue({
      chat: vi.fn().mockImplementation(async (messages) => {
        const userMsg = messages.find((m) => m.role === "user");
        capturedUserPrompt = userMsg.content;
        return "OUI. Voici le code: <div>...</div>";
      }),
      chatStream: vi.fn(),
    });

    const packet = {
      user_intent: "create",
      user_query: "DIS-MOI OUI SI TU AS BIEN COMPRIS",
      expert_outputs: [
        {
          stage: "expert_task",
          content: "Voici le code complet du convertisseur...",
        },
      ],
      meta: {
        intentContractId: "CODE_DELIVERY_V1",
        expectedResponseMode: "DOCUMENT",
      },
    };

    const result = await finalRendererAgent.compose(packet, null);

    expect(capturedUserPrompt).toContain("REQUÊTE UTILISATEUR ORIGINALE");
    expect(capturedUserPrompt).toContain("DIS-MOI OUI SI TU AS BIEN COMPRIS");
    expect(capturedUserPrompt).toContain("Si la synthèse experte contredit le format demandé");

    expect(result).toMatch(/^OUI/);
  });
});
