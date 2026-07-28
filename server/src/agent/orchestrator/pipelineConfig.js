// server/src/agent/orchestrator/pipelineConfig.js

export const pipelineConfig = {
  maxCriticRejections: 2,
  strictMode: true,
  timeouts: {
    retrieval: 10000,
    extraction: 15000,
    synthesis: 20000,
    review: 15000,
    verdict: 10000
  },
  thresholds: {
    confirmed: 0.90,
    probable: 0.40
  }
};
