export function dedupeCandidates(candidates) {
  const seenHashes = new Set();
  const deduped = [];

  for (const candidate of candidates) {
    // Exact hash deduplication
    if (seenHashes.has(candidate.hash)) {
      continue;
    }
    seenHashes.add(candidate.hash);
    
    // In V1, we just do exact hash deduplication.
    // Further heuristic deduplication (e.g. same file & line ranges overlapping) could be added here.
    deduped.push(candidate);
  }

  return deduped;
}
