import { describe, it, expect } from "vitest";
import { validateDeliverablePromise } from "../src/agent/policies/deliverablePromiseGuard.js";

describe("deliverablePromiseGuard", () => {
  it("doit ignorer les branches autorisées (CODE_DELIVERY)", () => {
    const result = validateDeliverablePromise("voici le code complet de ton application", "CODE_DELIVERY");
    expect(result.ok).toBe(true);
    expect(result.severity).toBe("none");
  });

  it("doit renvoyer sanitize pour 1 pattern faible dans une branche normale", () => {
    const result = validateDeliverablePromise("Je peux fournir des idées", "COMPOSER");
    expect(result.ok).toBe(false);
    expect(result.severity).toBe("sanitize");
  });

  it("doit renvoyer block pour un pattern fort dans une branche normale", () => {
    const result = validateDeliverablePromise("voici le code pour ton module", "COMPOSER");
    expect(result.ok).toBe(false);
    expect(result.severity).toBe("block");
  });

  it("doit renvoyer block pour 2+ patterns", () => {
    const result = validateDeliverablePromise("je peux fournir des exemples et je vais générer le fichier", "COMPOSER");
    expect(result.ok).toBe(false);
    expect(result.severity).toBe("block");
  });

  it("doit renvoyer block pour une branche stricte même avec 1 pattern faible", () => {
    const result = validateDeliverablePromise("je peux générer", "CRITICAL");
    expect(result.ok).toBe(false);
    expect(result.severity).toBe("block");
  });

  it("doit ignorer les formulations propres (Délégation)", () => {
    const result = validateDeliverablePromise("Je peux lancer la génération du code", "COMPOSER");
    expect(result.ok).toBe(true);
  });
});
