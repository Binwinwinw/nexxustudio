import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import MakersChecker, { MakersChecker as NamedMakersChecker } from '../src/verification/makersChecker.js';

describe('MakersChecker', () => {
  it('exporte MakersChecker comme classe', () => {
    assert.equal(typeof NamedMakersChecker, 'function');
    assert.ok(new MakersChecker() instanceof MakersChecker);
  });

  it('exporte default MakersChecker', () => {
    assert.equal(typeof MakersChecker, 'function');
  });

  it('valide une décision avec consensus élevé', async () => {
    const checker = new MakersChecker({ consensusThreshold: 0.85 });
    const primaryDecision = {
      score: 0.9,
      containsFactualClaims: false,
      sources: [{ id: 'src-1' }],
    };
    const context = { skillAccuracy: 0.9, sourceReliability: 0.95 };

    const result = await checker.validateDecision(primaryDecision, context);

    assert.equal(result.outcome, 'confirmed');
    assert.equal(result.verified, true);
    assert.ok(result.consensus >= 0.85);
  });

  it('fallback vers primary quand consensus bas', async () => {
    const checker = new MakersChecker({
      consensusThreshold: 0.85,
      fallbackToPrimary: true,
    });
    const primaryDecision = { score: 0.7, containsFactualClaims: true, sources: [] };
    const context = { skillAccuracy: 0.75, sourceReliability: 0.8 };

    const result = await checker.validateDecision(primaryDecision, context);

    assert.equal(result.outcome, 'fallback-primary');
    assert.equal(result.verified, false);
    assert.ok(result.warning);
  });

  it('bloque décision en mode fail-closed', async () => {
    const checker = new MakersChecker({
      consensusThreshold: 0.85,
      fallbackToPrimary: false,
    });
    const primaryDecision = { score: 0.6, containsFactualClaims: true, sources: [] };
    const context = { skillAccuracy: 0.65, sourceReliability: 0.7 };

    const result = await checker.validateDecision(primaryDecision, context);

    assert.equal(result.outcome, 'blocked');
    assert.equal(result.verified, false);
    assert.ok(result.error);
  });

  it('bloque si risque sécurité élevé (fail-closed)', async () => {
    const checker = new MakersChecker({ fallbackToPrimary: false });
    const primaryDecision = {
      score: 0.95,
      containsFactualClaims: false,
      containsPromptInjectionPatterns: true,
    };

    const result = await checker.validateDecision(primaryDecision, {});

    assert.equal(result.outcome, 'blocked');
    assert.equal(result.verified, false);
  });

  it('détecte hallucination potentielle', () => {
    const checker = new MakersChecker();
    const result = { score: 0.9, containsFactualClaims: true, sources: [] };

    const risk = checker.assessHallucinationRisk(result, {});

    assert.ok(risk >= 0.4);
  });

  it('génère rapport Markdown complet', async () => {
    const checker = new MakersChecker();
    const primaryDecision = {
      score: 0.9,
      containsFactualClaims: false,
      sources: [{ id: '1' }],
    };
    const context = { skillAccuracy: 0.9, sourceReliability: 0.95 };

    const result = await checker.validateDecision(primaryDecision, context);
    const report = checker.generateReport(result);

    assert.match(report, /# Makers-Checker Validation Report/);
    assert.match(report, /confirmed/i);
    assert.match(report, /Consensus/);
    assert.match(report, /Hallucination/);
  });

  it('calcule consensus pondéré (checker poids 0.6)', () => {
    const checker = new MakersChecker();
    const primaryResult = { score: 0.8 };
    const checkerResult = { score: 0.9 };

    const consensus = checker.calculateConsensus(primaryResult, checkerResult);

    assert.equal(consensus, 0.86);
  });

  it('évalue risque sécurité code exécution', () => {
    const checker = new MakersChecker();
    const result = { containsCodeExecution: true };

    const risk = checker.assessSecurityRisk(result, {});

    assert.ok(risk >= 0.5);
  });
});
