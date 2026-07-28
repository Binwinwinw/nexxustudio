export default {
  async search(queryEnvelope, routingDecision) {
    // Dummy V1 implementation for log search
    return [
      {
        source_type: "logs",
        source_name: "server/logs/app.log",
        content: "[KnowledgeHub] Error: Failed to connect to chromadb on port 8008",
        locator: {
          path: "server/logs/app.log",
          line_start: 412,
          line_end: 412
        }
      }
    ];
  }
};
