import { describe, it, expect } from "vitest";
import { isAcknowledgmentRequest } from "../src/agent/utils/acknowledgmentIntentGuards.js";

describe("isAcknowledgmentRequest", () => {
  it("Positif fort : dis-moi oui si tu as bien compris", () => {
    const query = "Salut Nexxus, j'aimerais creer un convertisseur d'unites modulaire en React. DIS-MOI OUI SI TU AS BIEN COMPRIS.";
    expect(isAcknowledgmentRequest(query)).toBe(true);
  });

  it("Positif fort court : as-tu bien compris", () => {
    const query = "Est-ce que tu as bien compris ce que je veux faire ?";
    expect(isAcknowledgmentRequest(query)).toBe(true);
  });

  it("Positif moyen : confirme que tu as compris", () => {
    const query = "Confirme que tu as compris la demande";
    expect(isAcknowledgmentRequest(query)).toBe(true);
  });
  
  it("Positif : dis moi si c'est clair", () => {
    const query = "Voilà mon besoin. Dis moi si c'est clair.";
    expect(isAcknowledgmentRequest(query)).toBe(true);
  });

  it("Négatif : tu as compris ce bug ? (échange technique sans demande stricte d'accusé)", () => {
    const query = "tu as compris ce bug dans le composant React ?";
    expect(isAcknowledgmentRequest(query)).toBe(false);
  });

  it("Négatif : requête standard", () => {
    const query = "Crée un convertisseur d'unités";
    expect(isAcknowledgmentRequest(query)).toBe(false);
  });
});
