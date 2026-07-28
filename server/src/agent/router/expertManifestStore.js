import fs from "fs-extra";
import path from "path";
import caveman from "../../utils/cavemanShrink.js";

/**
 * [MODULE: expertManifestStore]
 * Rôle: Lecture, normalisation, cache et hydratation paresseuse des experts.
 */

export function normalizeRawExpertManifest(raw, fileDivision, filePath) {
  if (!raw) return null;

  const division = raw.division || fileDivision || "General";
  const key = raw.key;
  if (!key) return null;

  const CRITICAL_KEYS = [
    "auditeur",
    "architect",
    "security",
    "governance",
    "souverainete",
  ];
  const isCritical = CRITICAL_KEYS.some((ck) => key.toLowerCase().includes(ck));

  let assignedModel = raw.model;
  if (!assignedModel) {
    if (isCritical) {
      assignedModel = "qwen3.5:27b";
    } else if (
      division === "Elite" ||
      division === "Forge" ||
      key.includes("developer")
    ) {
      assignedModel = "qwen2.5-coder:7b";
    } else if (key.includes("vision") || key.includes("vl")) {
      assignedModel = "gemma4:12b";
    } else {
      assignedModel = "ornith:9b";
    }
  }

  return {
    key,
    name: raw.name || raw.key || "Expert",
    description: raw.description || "",
    division,
    scope: Array.isArray(raw.scope)
      ? raw.scope
      : raw.scope
        ? [String(raw.scope)]
        : [],
    when_to_use: Array.isArray(raw.when_to_use)
      ? raw.when_to_use
      : raw.when_to_use
        ? [String(raw.when_to_use)]
        : [],
    model: assignedModel,
    fullKey: `${division}:${key}`,
    filePath,
    permissions: raw.permissions || {
      allowedTools: [
        "workspaceSearch",
        "knowledgeSearch",
        "webSearch",
        "webSummarize",
      ],
      disallowedTools: ["writeFile", "buildProject", "promoteProject"],
      safetyLevel: "STRICT",
    },
  };
}

export function extractManifestsFromFile(content, fileName, filePath) {
  const fileDivision = content.division || "General";

  if (Array.isArray(content.experts)) {
    return content.experts
      .map((rawExpert) => {
        const exp = normalizeRawExpertManifest(
          rawExpert,
          fileDivision,
          filePath,
        );
        if (!exp)
          console.warn(
            `[ManifestStore] skipping malformed expert in ${fileName}`,
          );
        return exp;
      })
      .filter((e) => e);
  }

  const single = normalizeRawExpertManifest(content, fileDivision, filePath);
  if (single) {
    return [single];
  }

  return [];
}

export async function hydrateExpert(manifest) {
  try {
    const content = await fs.readJson(manifest.filePath);
    let fullExpert = null;
    if (Array.isArray(content.experts)) {
      fullExpert = content.experts.find((e) => e.key === manifest.key);
    } else if (content.key === manifest.key) {
      fullExpert = content;
    }

    if (fullExpert) {
      const compressed = caveman.shrinkObject(
        fullExpert,
        ["description", "when_to_use", "scope"],
        caveman.INTENSITY.LITE,
      );
      compressed.division = compressed.division || manifest.division;
      compressed.fullKey = manifest.fullKey;
      return compressed;
    }
  } catch (err) {
    console.error(
      `[ManifestStore] Hydration error for ${manifest.key}:`,
      err.message,
    );
  }
  return null;
}
