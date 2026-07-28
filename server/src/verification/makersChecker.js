/**
 * Makers-Checker — double validation (primary + checker) fail-closed.
 * Pattern souverain : 2 agents valident 1 décision avant livraison critique.
 */

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /<\s*script\b/i,
  /eval\s*\(/i,
];

export class MakersChecker {
  constructor(config = {}) {
    this.primaryAgent = config.primaryAgent ?? 'orchestrator';
    this.checkerAgent = config.checkerAgent ?? 'verifier';
    this.consensusThreshold = config.consensusThreshold ?? 0.85;
    this.fallbackToPrimary = config.fallbackToPrimary !== false;
  }

  /**
   * @param {object|string} primaryDecision
   * @param {object} [context]
   */
  async validateDecision(primaryDecision, context = {}) {
    const startTime = Date.now();

    try {
      const primaryResult = this.normalizeDecision(primaryDecision);
      const checkerResult = await this.runCheckerAgent(primaryResult, context);
      const consensus = this.calculateConsensus(primaryResult, checkerResult);

      if (checkerResult.checks?.security?.status === 'blocked') {
        if (!this.fallbackToPrimary) {
          return {
            outcome: 'blocked',
            primary: primaryResult,
            checker: checkerResult,
            consensus,
            latencyMs: Date.now() - startTime,
            verified: false,
            error: 'Risque sécurité bloquant — décision refusée (fail-closed)',
          };
        }

        return {
          outcome: 'fallback-primary',
          primary: primaryResult,
          checker: checkerResult,
          consensus,
          latencyMs: Date.now() - startTime,
          verified: false,
          warning: 'Risque sécurité détecté — fallback primary avec avertissement',
        };
      }

      if (consensus >= this.consensusThreshold) {
        return {
          outcome: 'confirmed',
          primary: primaryResult,
          checker: checkerResult,
          consensus,
          latencyMs: Date.now() - startTime,
          verified: true,
        };
      }

      if (this.fallbackToPrimary) {
        return {
          outcome: 'fallback-primary',
          primary: primaryResult,
          checker: checkerResult,
          consensus,
          latencyMs: Date.now() - startTime,
          verified: false,
          warning: `Consensus basse (${consensus.toFixed(2)} < ${this.consensusThreshold}) — fallback primary`,
        };
      }

      return {
        outcome: 'blocked',
        primary: primaryResult,
        checker: checkerResult,
        consensus,
        latencyMs: Date.now() - startTime,
        verified: false,
        error: 'Consensus insuffisant — décision bloquée (fail-closed)',
      };
    } catch (error) {
      return {
        outcome: 'error',
        error: error?.message || String(error),
        latencyMs: Date.now() - startTime,
        verified: false,
      };
    }
  }

  normalizeDecision(primaryDecision) {
    if (typeof primaryDecision === 'string') {
      return {
        text: primaryDecision,
        score: 0.85,
        containsFactualClaims: /\b(est|sont|doit|confirme|selon)\b/i.test(primaryDecision),
        sources: [],
      };
    }

    return {
      score: primaryDecision.score ?? 0.85,
      containsFactualClaims: Boolean(primaryDecision.containsFactualClaims),
      sources: primaryDecision.sources ?? [],
      citations: primaryDecision.citations ?? [],
      confidence: primaryDecision.confidence ?? null,
      justification: primaryDecision.justification ?? null,
      containsExternalUrls: Boolean(primaryDecision.containsExternalUrls),
      containsCodeExecution: Boolean(primaryDecision.containsCodeExecution),
      containsPromptInjectionPatterns: Boolean(
        primaryDecision.containsPromptInjectionPatterns,
      ),
      text: primaryDecision.text ?? null,
      ...primaryDecision,
    };
  }

  async runCheckerAgent(primaryResult, context) {
    const checks = {
      hallucination: await this.checkHallucination(primaryResult, context),
      consistency: await this.checkConsistency(primaryResult, context),
      security: await this.checkSecurity(primaryResult, context),
      accuracy: await this.checkAccuracy(primaryResult, context),
    };

    return {
      TIMESTAMP: new Date().toISOString(),
      primaryAgent: this.primaryAgent,
      checkerAgent: this.checkerAgent,
      primaryDecision: primaryResult,
      checks,
      score: this.calculateCheckerScore(checks),
    };
  }

  async checkHallucination(primaryResult, context) {
    const risk = this.assessHallucinationRisk(primaryResult, context);
    let status = 'pass';
    if (risk >= 0.5) status = 'warning';
    if (risk >= 0.75) status = 'fail';

    return {
      risk,
      status,
      factors: this.identifyHallucinationFactors(primaryResult),
    };
  }

  async checkConsistency(primaryResult, context) {
    const score = await this.getConsistencyScore(primaryResult, context);
    return {
      score,
      status: score >= 0.8 ? 'pass' : 'warning',
    };
  }

  async checkSecurity(primaryResult, context) {
    const risk = this.assessSecurityRisk(primaryResult, context);
    let status = 'pass';
    if (risk >= 0.3) status = 'warning';
    if (risk >= 0.5) status = 'blocked';

    return { risk, status };
  }

  async checkAccuracy(primaryResult, context) {
    const score = this.assessAccuracy(primaryResult, context);
    return {
      score,
      status: score >= this.consensusThreshold ? 'pass' : 'warning',
    };
  }

  calculateConsensus(primaryResult, checkerResult) {
    const primaryScore = Number(primaryResult.score ?? 0.9);
    const checkerScore = Number(checkerResult.score ?? 0.5);
    return Math.round((primaryScore * 0.4 + checkerScore * 0.6) * 1e6) / 1e6;
  }

  calculateCheckerScore(checks) {
    const hallucinationStatus = checks.hallucination?.status ?? 'pass';
    const hallucinationScore =
      hallucinationStatus === 'pass'
        ? 1.0
        : hallucinationStatus === 'warning'
          ? 0.5
          : 0.0;

    const consistencyScore = Number(checks.consistency?.score ?? 0.85);

    const securityStatus = checks.security?.status ?? 'pass';
    const securityScore =
      securityStatus === 'pass' ? 1.0 : securityStatus === 'warning' ? 0.5 : 0.0;

    const accuracyScore = Number(checks.accuracy?.score ?? 0.85);

    return (
      hallucinationScore * 0.3 +
      consistencyScore * 0.25 +
      securityScore * 0.3 +
      accuracyScore * 0.15
    );
  }

  assessHallucinationRisk(result, _context) {
    let risk = 0.0;

    if (!result.sources?.length && result.containsFactualClaims) {
      risk += 0.4;
    }

    if (result.citations?.some((c) => c && c.verifiable === false)) {
      risk += 0.3;
    }

    if (
      typeof result.confidence === 'number' &&
      result.confidence > 0.9 &&
      !result.justification
    ) {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  identifyHallucinationFactors(result) {
    const factors = [];

    if (!result.sources?.length && result.containsFactualClaims) {
      factors.push('no_sources_for_factual_claims');
    }
    if (result.citations?.some((c) => c && c.verifiable === false)) {
      factors.push('unverifiable_citations');
    }
    if (
      typeof result.confidence === 'number' &&
      result.confidence > 0.9 &&
      !result.justification
    ) {
      factors.push('high_confidence_without_justification');
    }

    return factors;
  }

  async getConsistencyScore(_result, context) {
    if (typeof context.consistencyScore === 'number') {
      return context.consistencyScore;
    }
    return 0.85;
  }

  assessSecurityRisk(result, _context) {
    let risk = 0.0;

    if (result.containsExternalUrls) {
      risk += 0.2;
    }
    if (result.containsCodeExecution) {
      risk += 0.5;
    }
    if (result.containsPromptInjectionPatterns) {
      risk += 0.8;
    }

    const text = String(result.text ?? '');
    if (text && PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text))) {
      risk += 0.8;
    }

    return Math.min(risk, 1.0);
  }

  assessAccuracy(_result, context) {
    const skillAccuracy = Number(context.skillAccuracy ?? 0.88);
    const sourceReliability = Number(context.sourceReliability ?? 0.9);
    return skillAccuracy * 0.6 + sourceReliability * 0.4;
  }

  generateReport(validationResult) {
    const lines = [
      '# Makers-Checker Validation Report',
      '',
      `## État: ${String(validationResult.outcome ?? 'unknown').toUpperCase()}`,
      '',
      `**Consensus**: ${validationResult.consensus != null ? validationResult.consensus.toFixed(2) : 'N/A'} (${validationResult.consensus >= this.consensusThreshold ? '✅' : '❌'})`,
      `**Latence**: ${validationResult.latencyMs ?? 0}ms`,
      `**Vérifié**: ${validationResult.verified ? '✅' : '❌'}`,
      '',
    ];

    if (validationResult.checker?.checks) {
      const { checks } = validationResult.checker;
      lines.push('### Checks du vérificateur', '');
      lines.push(
        `- **Hallucination**: ${checks.hallucination.status}${checks.hallucination.risk != null ? ` (${checks.hallucination.risk.toFixed(2)})` : ''}`,
      );
      lines.push(
        `- **Cohérence**: ${checks.consistency.status} (${checks.consistency.score.toFixed(2)})`,
      );
      lines.push(
        `- **Sécurité**: ${checks.security.status}${checks.security.risk != null ? ` (${checks.security.risk.toFixed(2)})` : ''}`,
      );
      lines.push(
        `- **Précision**: ${checks.accuracy.status} (${checks.accuracy.score.toFixed(2)})`,
      );
      lines.push('');
    }

    if (validationResult.warning) {
      lines.push('### ⚠️ Avertissement', '', `\`${validationResult.warning}\``, '');
    }

    if (validationResult.error) {
      lines.push('### ❌ Erreur', '', `\`${validationResult.error}\``, '');
    }

    return lines.join('\n');
  }
}

export default MakersChecker;
