export default {
  async search(queryEnvelope, routingDecision) {
    // Dummy V1 implementation for DB search
    return [
      {
        source_type: "db",
        source_name: "project_sessions",
        content: JSON.stringify({ id: "sess_001", current_phase: "DISCOVERY" }),
        locator: {
          table: "project_sessions",
          query: "SELECT * FROM project_sessions WHERE id = ?"
        }
      }
    ];
  }
};
