import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { assessPromotionEligibility } from "./memoryPromotionPolicy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_ROOT = path.resolve(__dirname, "../../../../data/memory");

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function promoteToEpisodicFile(storeRecord, packet) {
  const epId = `EP-${Date.now().toString().slice(-4)}`;
  const epPath = path.join(MEMORY_ROOT, "episodic", `${epId}.json`);

  const episode = {
    id: epId,
    storeId: storeRecord.id,
    timestamp: storeRecord.timestamp,
    subject: storeRecord.subject,
    scope: storeRecord.scope,
    content: storeRecord.proposed_memory?.content,
    normalized_facts: storeRecord.proposed_memory?.normalized_facts || [],
    evidence: storeRecord.evidence,
    status: "stable",
    confidence:
      storeRecord.confidence >= 0.75 ? "verified" : "hypothesis",
    promotion_tier: "episodic",
    promotedAt: new Date().toISOString(),
    provenance: packet.meta?.provenance || {},
    policyVersion: "memory_promotion_v1",
  };

  await ensureDir(path.dirname(epPath));
  await fs.writeFile(epPath, JSON.stringify(episode, null, 2), "utf-8");
  return { status: "promoted", target: "episodic", id: epId, path: epPath };
}

async function promoteToSemanticFile(storeRecord, packet) {
  const factId = `SF-${storeRecord.id.replace(/-/g, "").slice(0, 8)}`;
  const factPath = path.join(MEMORY_ROOT, "semantic", "facts", `${factId}.json`);

  const fact = {
    id: factId,
    storeId: storeRecord.id,
    timestamp: storeRecord.timestamp,
    subject: storeRecord.subject,
    scope: storeRecord.scope,
    title: storeRecord.proposed_memory?.title,
    content: storeRecord.proposed_memory?.content,
    normalized_facts: storeRecord.proposed_memory?.normalized_facts || [],
    evidence: storeRecord.evidence,
    confidence: storeRecord.confidence,
    status: "active",
    promotion_tier: "semantic",
    promotedAt: new Date().toISOString(),
    provenance: packet.meta?.provenance || {},
    policyVersion: "memory_promotion_v1",
  };

  await ensureDir(path.dirname(factPath));
  await fs.writeFile(factPath, JSON.stringify(fact, null, 2), "utf-8");
  return { status: "promoted", target: "semantic", id: factId, path: factPath };
}

async function proposeHeritagePrinciple(storeRecord, packet) {
  const procDir = path.join(MEMORY_ROOT, "procedural");
  await ensureDir(procDir);

  const files = await fs.readdir(procDir).catch(() => []);
  const indices = files
    .map((f) => parseInt(f.match(/PR-(\d+)/)?.[1] || "0", 10))
    .filter((n) => n > 0);
  const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 10;
  const prId = `PR-${String(nextIndex).padStart(3, "0")}`;
  const safeTitle = (storeRecord.proposed_memory?.title || storeRecord.subject || "Principe")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  const prPath = path.join(procDir, `${prId}_PROMOTED_${safeTitle}.json`);

  const principle = {
    id: prId,
    title: storeRecord.proposed_memory?.title || storeRecord.subject,
    description: storeRecord.proposed_memory?.content,
    guidelines: storeRecord.proposed_memory?.normalized_facts || [],
    source_memory_ids: [storeRecord.id],
    evidence: storeRecord.evidence,
    createdAt: new Date().toISOString(),
    version: "1.0.0",
    status: "proposed",
    confidence: storeRecord.confidence,
    promotion_tier: "heritage",
    provenance: packet.meta?.provenance || {},
    policyVersion: "memory_promotion_v1",
    requires_human_validation: true,
  };

  await fs.writeFile(prPath, JSON.stringify(principle, null, 2), "utf-8");
  return {
    status: "promoted",
    target: "heritage",
    id: prId,
    path: prPath,
    requiresHumanValidation: true,
  };
}

/**
 * Exécute la promotion post-commit selon memoryPromotionPolicy v1.
 */
export async function executeMemoryPromotion(storeRecord, packet) {
  const assessment = assessPromotionEligibility(storeRecord, packet);

  if (!assessment.eligible) {
    return {
      status: "promotion_refused",
      target: assessment.target,
      reasons: assessment.reasons,
      policyVersion: assessment.policyVersion,
    };
  }

  switch (assessment.target) {
    case "episodic":
      return promoteToEpisodicFile(storeRecord, packet);
    case "semantic":
      return promoteToSemanticFile(storeRecord, packet);
    case "heritage":
      return proposeHeritagePrinciple(storeRecord, packet);
    default:
      return {
        status: "promotion_refused",
        reasons: ["unknown_target"],
        policyVersion: assessment.policyVersion,
      };
  }
}

export default { executeMemoryPromotion };
