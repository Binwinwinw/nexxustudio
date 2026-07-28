export default {
  async search(queryEnvelope, routingDecision) {
    // Dummy V1 implementation for code search
    return [
      {
        source_type: "code",
        source_name: "server/src/agent/orchestrator/runPipeline.js",
        content: "export async function runPipeline(queryEnvelope) { ... }",
        locator: {
          path: "server/src/agent/orchestrator/runPipeline.js",
          line_start: 1,
          line_end: 50
        }
      }
    ];
  }
};
