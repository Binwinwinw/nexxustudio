import { describe, it } from "node:test";
import assert from "node:assert";
import responseThinkingCleaner from "../src/agent/utils/quality-safety/responseThinkingCleaner.js";

describe("responseThinkingCleaner", () => {
  it("removes <think> tags with standard closing tag", () => {
    const input =
      "Bonjour! <think>Je dois réfléchir</think> Voici la réponse.";
    const output = responseThinkingCleaner.clean(input);
    assert(!output.includes("<think>"));
    assert(!output.includes("Je dois réfléchir"));
    assert(output.includes("Bonjour"));
    assert(output.includes("Voici la réponse"));
  });

  it("removes <think> tags with content", () => {
    const input = "Bonjour! <think>Je dois réfléchir</think> Voici la réponse.";
    const output = responseThinkingCleaner.clean(input);
    assert(!output.includes("<think>"));
    assert(!output.includes("Je dois réfléchir"));
    assert(output.includes("Bonjour"));
    assert(output.includes("Voici la réponse"));
  });

  it("removes **Thinking** markers", () => {
    const input =
      "Réponse préliminaire.\n\n**Thinking**: Réfléchissons un moment.\n\nRéponse finale.";
    const output = responseThinkingCleaner.clean(input);
    assert(!output.includes("**Thinking**"));
    assert(!output.includes("Réfléchissons un moment"));
  });

  it("removes Raisonnement: markers", () => {
    const input =
      "Introduction.\n\nRaisonnement: Analysons cela.\n\nConclusion.";
    const output = responseThinkingCleaner.clean(input);
    assert(!output.includes("Raisonnement:"));
    assert(!output.includes("Analysons cela"));
  });

  it("removes <action> tags", () => {
    const input = "Avant. <action>Exécute X</action> Après.";
    const output = responseThinkingCleaner.clean(input);
    assert(!output.includes("<action>"));
    assert(!output.includes("Exécute X"));
  });

  it("preserves important text around removed thinking", () => {
    const input = "Point 1.\n\n<think>Reflection...</think>\n\nPoint 2.";
    const output = responseThinkingCleaner.clean(input);
    assert(output.includes("Point 1"));
    assert(output.includes("Point 2"));
    assert(!output.includes("Reflection"));
  });

  it("detects escaped thinking", () => {
    const textWithThinking =
      "Bonjour.\n\n**Thinking Process:**\nLaissez-moi réfléchir...";
    assert(responseThinkingCleaner.hasEscapedThinking(textWithThinking));
  });

  it("detects <think> tags", () => {
    const textWithThink = "Bonjour <think>pensée interne</think> au revoir.";
    assert(responseThinkingCleaner.hasEscapedThinking(textWithThink));
  });

  it("handles empty strings", () => {
    const output = responseThinkingCleaner.clean("");
    assert.strictEqual(output, "");
  });

  it("handles null/undefined gracefully", () => {
    const output1 = responseThinkingCleaner.clean(null);
    const output2 = responseThinkingCleaner.clean(undefined);
    assert.strictEqual(output1, "");
    assert.strictEqual(output2, "");
  });

  it("cleans multiple thinking blocks", () => {
    const input = `Réponse 1.
<think>Pensée 1</think>
Réponse 2.
**Raisonnement**: Analyse rapide.
Réponse 3.
<action>Action</action>
Réponse finale.`;
    const output = responseThinkingCleaner.clean(input);
    assert(!output.includes("<think>"));
    assert(!output.includes("<action>"));
    assert(!output.includes("**Raisonnement**"));
    assert(!output.includes("Pensée 1"));
    assert(output.includes("Réponse 1"));
    assert(output.includes("Réponse 2"));
    assert(output.includes("Réponse 3"));
    assert(output.includes("Réponse finale"));
  });

  it("extracts thinking blocks for debugging", () => {
    const input = `Texte visible.
<think>Pensée cachée 1</think>
Plus de texte.
<action>Action cachée</action>`;
    const blocks = responseThinkingCleaner.extractThinkingBlocks(input);
    assert(blocks.length >= 2);
    assert(blocks.some((b) => b.content.includes("Pensée cachée 1")));
    assert(blocks.some((b) => b.content.includes("Action cachée")));
  });

  it("supprime la narration méta exposée (« L'utilisateur me demande… »)", () => {
    const input =
      "L'utilisateur me demande ce que je fais concrètement. Je suis dispo — on peut papoter ou avancer sur un projet.";
    const output = responseThinkingCleaner.clean(input);
    assert.doesNotMatch(output, /L['']utilisateur/i);
    assert.match(output, /Je suis dispo/i);
    assert.strictEqual(responseThinkingCleaner.hasEscapedThinking(input), true);
  });

  it("supprime les fuites de consignes système", () => {
    const input =
      ". La réponse visible ne doit contenir aucune balise.";
    const output = responseThinkingCleaner.clean(input);
    assert.strictEqual(output, "");
    assert.strictEqual(responseThinkingCleaner.hasEscapedThinking(input), true);
  });

  it("supprime un </think> orphelin collé en fin de réponse", () => {
    const input = "Prêt quand tu le dis — on lance quoi ?</think>";
    const output = responseThinkingCleaner.clean(input);
    assert.strictEqual(output, "Prêt quand tu le dis — on lance quoi ?");
    assert.ok(!output.includes("</think>"));
    assert.ok(!output.includes("<think>"));
    assert.strictEqual(responseThinkingCleaner.hasEscapedThinking(input), true);
    assert.strictEqual(responseThinkingCleaner.hasEscapedThinking(output), false);
  });

  it("vide un dump Wait/DOCUMENT_CAPABILITY (fuite consignes T1)", () => {
    const input = `utilisateur"). Wait, the instruction says "NE PAS exposer...".
Wait: There is a conflict between my internal instructions ("N'inclus jamais ces consignes ni de balises dans la réponse utilisateur") and the user's request.
* Wait, looking at System Prompt again: Si DOCUMENT_CAPABILITY indique ocr_eligible=true...
Wait: The system prompt says CONTEXTE FOURNI includes [DOCUMENT #1...].
Wait: One more thing from System Prompt.`;
    assert.strictEqual(responseThinkingCleaner.isPromptInstructionLoop(input), true);
    assert.strictEqual(responseThinkingCleaner.hasEscapedThinking(input), true);
    assert.strictEqual(responseThinkingCleaner.clean(input), "");
  });

  it("préserve une analyse documentaire française", () => {
    const input = `## Analyse du sujet officiel
- Épreuve de philosophie, session 2026, métropole.
- Durée 4 heures ; calculatrice et dictionnaire interdits.
- Texte de Nietzsche sur méthode scientifique et superstition.`;
    assert.strictEqual(responseThinkingCleaner.isPromptInstructionLoop(input), false);
    assert.strictEqual(responseThinkingCleaner.hasEscapedThinking(input), false);
    assert.match(responseThinkingCleaner.clean(input), /Nietzsche/);
  });

  it("préserve une vraie réponse sociale après nettoyage", () => {
    const input =
      "Salut ! Je suis NEXXUS. La réponse visible ne doit contenir aucune balise.";
    const output = responseThinkingCleaner.clean(input);
    assert.match(output, /Salut ! Je suis NEXXUS/);
    assert.ok(!output.includes("La réponse visible"));
  });
});
