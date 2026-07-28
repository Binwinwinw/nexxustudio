import { describe, it, expect } from "vitest";
import { applySurfaceMicroContract } from "../src/agent/micro/parsing/surfaceMicroContract.js";

describe("applySurfaceMicroContract", () => {
  it("should extract one sentence when asked", () => {
    const query = "réponds en une seule phrase";
    const text = "Ceci est la première phrase. Et voici la seconde. Et la troisième.";
    
    const result = applySurfaceMicroContract(query, text);
    expect(result).toBe("Ceci est la première phrase.");
  });

  it("should keep only yes/no sentence if requested and present", () => {
    const query = "dis moi oui ou non";
    const text = "Oui, c'est tout à fait exact. En effet, je suis d'accord.";
    
    const result = applySurfaceMicroContract(query, text);
    expect(result).toBe("Oui, c'est tout à fait exact.");
  });

  it("should not force yes/no if text doesn't start with it", () => {
    const query = "dis moi oui ou non";
    const text = "Je pense que la situation est complexe. Ce n'est pas binaire.";
    
    const result = applySurfaceMicroContract(query, text);
    expect(result).toBe("Je pense que la situation est complexe. Ce n'est pas binaire.");
  });

  it("should remove intro if just answer is requested", () => {
    const query = "juste la réponse pas de blabla";
    const text = "Bien sûr, voici la réponse: Paris est la capitale.";
    
    const result = applySurfaceMicroContract(query, text);
    expect(result).toBe("Paris est la capitale.");
  });
});
