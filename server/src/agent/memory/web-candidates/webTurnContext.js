/**
 * Contexte du dernier tour web réussi (consommé une fois par le hook post-chat).
 */
let lastSnapshot = null;

export function stashWebTurnSnapshot(snapshot = {}) {
  if (!snapshot?.webPacket?.sources?.length) return;
  lastSnapshot = {
    stashedAt: new Date().toISOString(),
    query: snapshot.query || "",
    webPacket: snapshot.webPacket,
    sessionId: snapshot.sessionId || null,
    pipelineMode: snapshot.pipelineMode || "SIMPLE_FAST",
  };
}

export function peekWebTurnSnapshot() {
  return lastSnapshot;
}

export function consumeWebTurnSnapshot() {
  const snap = lastSnapshot;
  lastSnapshot = null;
  return snap;
}

export function clearWebTurnSnapshotForTests() {
  lastSnapshot = null;
}
