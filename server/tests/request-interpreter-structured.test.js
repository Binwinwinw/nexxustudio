import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import {
  buildStructuredRequestPromptAddon,
  interpretStructuredRequest,
  resolveInterpreterLock,
  REQUEST_INTERPRETER_CONTRACT_ID,
} from "../src/agent/interpreter/RequestInterpreter.js";
import {
  computeCompositeScore,
  CONFIDENCE_THRESHOLDS,
} from "../src/agent/interpreter/requestInterpreter.scoring.js";

const WINDOWS_LOCATION_QUERY =
  "pourrait on retrouver un ordinateur windows 11 avec son ID-produit ou sa clé produit en le localisant ?";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("RequestInterpreter — scoring composite calibré", () => {
  const score = computeCompositeScore({
    lexical: 1,
    semantic: 1,
    pattern: 0.5,
    context: 0,
  });

  assert.equal(score, 0.8);
  assert.equal(CONFIDENCE_THRESHOLDS.direct, 0.8);
});

test("RequestInterpreter — localisation Windows par ID-produit garde sujet et instrument", () => {
  const out = interpretStructuredRequest(
    "pourrait on retrouver un ordinateur windows 11 avec son ID-produit ou sa clé produit ?",
  );

  assert.equal(out.contract, REQUEST_INTERPRETER_CONTRACT_ID);
  assert.equal(out.family, "software_help");
  assert.equal(out.subtype, "license_or_device_location");
  assert.equal(out.user_goal, "determine_if_product_id_or_key_can_locate_windows_pc");
  assert.equal(out.object, "ordinateur Windows 11");
  assert.deepEqual(out.instrument, ["ID-produit", "clé produit"]);
  assert.equal(out.needs_clarification, false);
  assert.equal(out.suggested_pipeline, "direct_explanation");
  assert.ok(out.confidence >= 0.8);
  assert.ok(out.risk_flags.includes("subject_instrument_inversion"));
  assert.ok(out.risk_flags.includes("identifier_vs_asset_confusion"));
});

test("RequestInterpreter — localisation explicite ajoute location_vs_recovery_confusion", () => {
  const out = interpretStructuredRequest(WINDOWS_LOCATION_QUERY);

  assert.equal(out.family, "software_help");
  assert.equal(out.object, "ordinateur Windows 11");
  assert.deepEqual(out.instrument, ["ID-produit", "clé produit"]);
  assert.ok(out.risk_flags.includes("location_vs_recovery_confusion"));
  assert.equal(out.suggested_pipeline, "direct_explanation");
});

test("RequestInterpreter — sortie conforme au schema JSON", () => {
  const schemaPath = path.resolve(
    __dirname,
    "../src/agent/interpreter/requestInterpreter.schema.json",
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ strict: false });
  const validate = ajv.compile(schema);
  const out = interpretStructuredRequest(WINDOWS_LOCATION_QUERY);

  assert.equal(validate(out), true, JSON.stringify(validate.errors || []));
});

test("RequestInterpreter — addon prompt protège contre l'inversion sujet instrument", () => {
  const addon = buildStructuredRequestPromptAddon(WINDOWS_LOCATION_QUERY);

  assert.match(addon, /REQUEST_INTERPRETER_V1/);
  assert.match(addon, /subject_instrument_inversion/);
  assert.match(addon, /ne renverse pas sujet et instrument/i);
  assert.match(addon, /ordinateur Windows 11/);
});

test("RequestInterpreter — lock force direct_explanation haute confiance", () => {
  const out = interpretStructuredRequest(WINDOWS_LOCATION_QUERY);
  const lock = resolveInterpreterLock(out);

  assert.equal(lock.locked, true);
  assert.equal(lock.forced_contract_id, "DIRECT_EXPLANATION");
  assert.equal(lock.forced_intent, "factual_light");
  assert.ok(lock.forbidden_contracts.includes("CODE_DELIVERY_V1"));
  assert.ok(lock.forbidden_intents.includes("expert_task"));
});

test("RequestInterpreter — demande code route build_v1", () => {
  const out = interpretStructuredRequest("corrige ce script JavaScript qui plante avec une stacktrace");

  assert.equal(out.family, "code_dev");
  assert.equal(out.subtype, "code_task");
  assert.equal(out.suggested_pipeline, "build_v1");
});

test("RequestInterpreter — plan de formation route build_v1", () => {
  const out = interpretStructuredRequest("prépare un plan de formation SharePoint pour débutants");

  assert.equal(out.family, "planning");
  assert.equal(out.subtype, "plan_or_training");
  assert.equal(out.suggested_pipeline, "build_v1");
});

test("RequestInterpreter — requête vide clarifie", () => {
  const out = interpretStructuredRequest("");

  assert.equal(out.family, "unknown");
  assert.equal(out.needs_clarification, true);
  assert.equal(out.suggested_pipeline, "clarify_user");
});
