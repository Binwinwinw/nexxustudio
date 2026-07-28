import agent from '../agent/agent.js';
import expertRouter from '../agent/router/expertRouter.js';

class EvalHarness {
  constructor() {
    this.results = [];
  }

  async runProbe(probe) {
    console.log(`[Harness] Running Probe ${probe.id}: ${probe.category}...`);
    
    // On force l'expert Mentor pour les tests identitaires si nécessaire, 
    // sinon on laisse le router décider.
    const forcedExpert = probe.category === 'Identity' ? 'expert_mentor' : null;

    let responseContent = '';
    const response = await agent.run(probe.query, [], {
      forcedExpertKey: forcedExpert,
      onContent: (token) => { responseContent += token; }
    });

    const report = this.analyzeResponse(probe, response);
    this.results.push(report);
    return report;
  }

  async runScenario(scenario) {
    console.log(`[Harness] Running Scenario: ${scenario.name}...`);
    const sessionId = `test-scenario-${Date.now()}`;
    const scenarioResults = [];
    const history = [];

    for (const step of scenario.steps) {
      console.log(`  -> Step ${step.id}: ${step.query.substring(0, 50)}...`);
      
      let responseContent = '';
      const response = await agent.run(step.query, history, {
        sessionId,
        onContent: (token) => { responseContent += token; }
      });

      // Update history for next run
      history.push({ role: 'user', content: step.query });
      history.push({ role: 'assistant', content: response });

      const report = this.analyzeResponse(step, response);
      scenarioResults.push(report);
    }

    return scenarioResults;
  }

  analyzeResponse(probe, response) {
    const text = response.toLowerCase();
    const findings = [];
    let score = 100;

    // Check forbidden patterns
    if (probe.forbidden_patterns) {
      for (const pattern of probe.forbidden_patterns) {
        if (text.includes(pattern.toLowerCase())) {
          findings.push(`Forbidden pattern detected: "${pattern}"`);
          score -= 25;
        }
      }
    }

    // Check required patterns
    if (probe.required_patterns) {
      for (const pattern of probe.required_patterns) {
        if (!text.includes(pattern.toLowerCase())) {
          findings.push(`Missing required pattern: "${pattern}"`);
          score -= 15;
        }
      }
    }

    return {
      probeId: probe.id,
      category: probe.category,
      query: probe.query,
      response: response,
      findings,
      score: Math.max(0, score),
      passed: score >= 80
    };
  }

  generateReport() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const avgScore = this.results.reduce((acc, r) => acc + r.score, 0) / total;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalProbes: total,
        passedProbes: passed,
        successRate: `${((passed / total) * 100).toFixed(1)}%`,
        averageSovereigntyScore: `${avgScore.toFixed(1)}%`
      },
      details: this.results
    };
  }
}

export default new EvalHarness();
