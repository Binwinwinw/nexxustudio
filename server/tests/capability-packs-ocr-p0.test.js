import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { match as matchOcr } from "../src/agent/capabilities/ocr/index.js";
import { registerOcrTools } from "../src/agent/capabilities/ocr/registerTools.js";
import { composeCapabilityContext, CAPABILITY_IDS } from "../src/agent/capabilities/index.js";
import {
  matchesOcrIntent,
  isSimpleVisionDescribeWithoutOcrNeed,
} from "../src/agent/capabilities/contractGuards.js";
import {
  parseOcrToolPayload,
  formatOcrToolResult,
} from "../src/agent/capabilities/ocr/ocrClient.js";
import {
  setCapabilityToolsForTurn,
  clearCapabilityToolsForTurn,
  isCapabilityToolEnabled,
} from "../src/agent/capabilities/capabilityToolSession.js";
import { getAllowedTools } from "../src/agent/policies/prompt/index.js";

const baseInput = {
  query: "",
  history: [],
  intentContractId: null,
  justIntent: {},
  conversationMove: {},
  attachments: [],
};

describe("capability packs OCR P0 — tool.ocr guards", () => {
  before(() => {
    process.env.OCR_SERVICE_URL = "http://127.0.0.1:8765";
    process.env.OCR_SERVICE_ASSUME_READY = "1";
  });

  after(() => {
    clearCapabilityToolsForTurn();
    delete process.env.OCR_SERVICE_URL;
    delete process.env.OCR_SERVICE_ASSUME_READY;
  });

  it("sans OCR_SERVICE_URL → inactif", () => {
    const prev = process.env.OCR_SERVICE_URL;
    delete process.env.OCR_SERVICE_URL;
    try {
      const hit = matchOcr({
        ...baseInput,
        query: "extrais le texte du pdf joint",
        intentContractId: "DOCUMENT_ANALYSIS",
        attachments: [{ originalname: "doc.pdf", mimetype: "application/pdf", path: "/tmp/x.pdf" }],
      });
      assert.equal(hit.active, false);
      assert.ok(hit.why.some((w) => w.includes("ocr_service_url_unset")));
    } finally {
      process.env.OCR_SERVICE_URL = prev;
    }
  });

  it("salut sans PJ → inactif", () => {
    const hit = matchOcr({ ...baseInput, query: "bonjour" });
    assert.equal(hit.active, false);
  });

  it("décris cette photo → vision simple, pas OCR", () => {
    assert.equal(
      isSimpleVisionDescribeWithoutOcrNeed("décris cette photo", [
        { mimetype: "image/png", originalname: "x.png" },
      ]),
      true,
    );
    const hit = matchOcr({
      ...baseInput,
      query: "décris cette photo",
      attachments: [{ mimetype: "image/png", originalname: "x.png", path: "/tmp/x.png" }],
    });
    assert.equal(hit.active, false);
    assert.ok(hit.why.includes("vision_simple_sufficient"));
  });

  it("PDF + extraire → actif + 2 outils", () => {
    const input = {
      ...baseInput,
      query: "extrais le texte de ce contrat pdf",
      intentContractId: "DOCUMENT_ANALYSIS",
      attachments: [
        { originalname: "contrat.pdf", mimetype: "application/pdf", path: "/tmp/c.pdf" },
      ],
    };
    const hit = matchOcr(input);
    assert.equal(hit.active, true);
    assert.equal(registerOcrTools(input).length, 2);
  });

  it("compose injecte instruction OCR sur tour document", () => {
    const ctx = composeCapabilityContext({
      ...baseInput,
      query: "convertir en markdown pour indexation",
      intentContractId: "GUIDED_DOCUMENT_SYNTHESIS",
      attachments: [{ originalname: "scan.pdf", mimetype: "application/pdf", path: "/tmp/s.pdf" }],
    });
    const ocrTel = ctx.telemetry.find((t) => t.id === CAPABILITY_IDS.OCR);
    assert.equal(ocrTel?.active, true);
    assert.ok(ctx.instructionBlocks.some((b) => b.includes("tool.ocr")));
  });

  it("session capability — ocr_* indisponibles hors tour", () => {
    clearCapabilityToolsForTurn();
    assert.equal(isCapabilityToolEnabled("ocr_page"), false);
    setCapabilityToolsForTurn(["ocr_page", "webSearch"]);
    assert.equal(isCapabilityToolEnabled("ocr_page"), true);
    assert.equal(getAllowedTools().includes("ocr_page"), true);
  });

  it("parseOcrToolPayload + formatOcrToolResult", () => {
    assert.deepEqual(parseOcrToolPayload("/tmp/a.png", "page"), { imagePath: "/tmp/a.png" });
    const formatted = formatOcrToolResult(
      { ok: true, durationMs: 1, data: { text: "hello", pages: 1 } },
      "ocr_page",
    );
    assert.equal(formatted, "hello");
  });

  it("matchesOcrIntent — lexique seul insuffisant sans PJ", () => {
    const m = matchesOcrIntent("extraire le ocr", null, { attachments: [] });
    assert.equal(m.active, false);
  });
});
