/**
 * F1 — task.kind tenu via guards existants.
 * Décision: D-20260909-frame-acte-autorite
 * Hors périmètre : contrats, SC emit, JUST consume, regex locale, cas produit.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  analyzeRequestIntentFrame,
  detectTaskKind,
} from "../src/agent/policies/intent/requestIntentFrame.js";

describe("F1 detectTaskKind — familles (guards existants)", () => {
  const familyCases = [
    {
      kind: "advise",
      queries: [
        "que me conseillerais-tu comme smartphone ?",
        "si tu étais à ma place tu prendrais quoi comme casque audio ?",
        "entre un SSD 1To et 2To lequel choisir pour du montage video ?",
      ],
    },
    {
      kind: "compare",
      queries: ["Pixel 8a vs Nothing Phone 3a lequel prendre ?"],
    },
    {
      kind: "debug",
      queries: ["pourquoi mon Redis crash avec cette erreur ECONNREFUSED"],
    },
    {
      kind: "procedure",
      queries: [
        "comment faire pour déclencher le handoff Forge dans Nexxus Studio",
        "comment faire pour lancer Need for Speed",
      ],
    },
  ];

  for (const { kind, queries } of familyCases) {
    for (const query of queries) {
      it(`${kind}: ${query.slice(0, 56)}`, () => {
        assert.equal(detectTaskKind(query), kind, query);
        assert.equal(analyzeRequestIntentFrame(query).task.kind, kind, query);
      });
    }
  }
});

describe("F1 detectTaskKind — voisins inchangés", () => {
  it("learn préempte advise (poker + conseillerais)", () => {
    const q = "pour un apprentissage du poker que me conseillerais-tu";
    assert.equal(detectTaskKind(q), "learn");
  });

  it("explain technique inchangé", () => {
    assert.equal(detectTaskKind("explique Redis"), "explain");
    assert.equal(detectTaskKind("Comment fonctionne HTTP/2 ?"), "explain");
  });

  it("social pur : task.kind reste null", () => {
    const frame = analyzeRequestIntentFrame("bonjour qu'est ce que tu fais de beau");
    assert.equal(frame.conversation.socialOnly, true);
    assert.equal(frame.task.kind, null);
  });

  it("create guidé : pas câblé (import JUST/cycle) — reste null", () => {
    const q =
      "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?";
    assert.equal(detectTaskKind(q), null);
  });

  it("code revue : pas d'acte debug inventé (guard code ≠ task.kind)", () => {
    const q =
      "Fais une revue de code Python de ce snippet. Commence par les erreurs bloquantes.";
    assert.equal(detectTaskKind(q), null);
  });
});

describe("F1 detectTaskKind — silence de guard = null (pas de regex)", () => {
  const silent = [
    "j'ai un téléphone nothing phone 3a quels conseils tu me donnerais pour l'achat d'un nouveau téléphone ?",
    "je cherche un ordi portable, tu as des pistes ?",
    "oriente-moi pour remplacer mon vélo",
    "Redis ou Memcached pour du cache session ?",
    "c'est quoi un Nothing Phone 3a ?",
  ];

  for (const query of silent) {
    it(`null: ${query.slice(0, 56)}`, () => {
      assert.equal(detectTaskKind(query), null, query);
    });
  }
});
