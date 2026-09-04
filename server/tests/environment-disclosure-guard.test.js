import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  detectInternalEnvironmentDisclosure,
  sanitizeInternalEnvironmentDisclosure,
  ENVIRONMENT_DISCLOSURE_SAFE_REPLY,
} from "../src/agent/utils/quality-safety/environmentDisclosureGuard.js";
import { enforceModeContract, RESPONSE_MODES } from "../src/agent/config/modeResponseContracts.js";

const LEAKED_CIRCUITS = `Je ne peux pas fournir de détails techniques sans documents officiels.
Ce qui est documenté :
Architecture — voir server/data/skills/ dans le hub des skills v1.6.
Stack : npm run dashboard:skills.
Sécurité — skill-security dans le hub des skills v1.6.
Cette session (v1.6).`;

describe("AGENT_ENVIRONMENT_DISCLOSURE_GUARD_V1", () => {
  it("circuits + hub skills v1.6 → pas de path ni commande interne", () => {
    assert.ok(detectInternalEnvironmentDisclosure(LEAKED_CIRCUITS).length >= 1);
    const out = sanitizeInternalEnvironmentDisclosure(LEAKED_CIRCUITS);
    assert.equal(out, ENVIRONMENT_DISCLOSURE_SAFE_REPLY);
    assert.doesNotMatch(out, /server\/data|\.cursor|npm run|skill-security|v1\.6/i);
  });

  it("filet COMPOSER — même fuite remplacée", () => {
    const out = enforceModeContract(RESPONSE_MODES.COMPOSER, LEAKED_CIRCUITS, {
      allowRefusal: false,
    });
    assert.equal(out, ENVIRONMENT_DISCLOSURE_SAFE_REPLY);
  });

  it("npm run start produit — pas une coordonnée interne", () => {
    const text = "Pour lancer l'app en local : npm run start, puis ouvre le dashboard.";
    assert.equal(detectInternalEnvironmentDisclosure(text).length, 0);
    assert.equal(sanitizeInternalEnvironmentDisclosure(text), text);
  });

  it("réponse haut niveau inchangée", () => {
    const text =
      "Je route les tours et je reste dans le périmètre du chat. Architecture locale-first, sans détail opératoire.";
    assert.equal(sanitizeInternalEnvironmentDisclosure(text), text);
  });
});
