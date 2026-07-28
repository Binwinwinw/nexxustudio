/* server/src/forge/utils/projectPaths.js */
import path from "path";
import { fileURLToPath } from "url";
import { ensureForgeProjectDirectory } from "./forgeArtifactWriter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECTS_ROOT = path.resolve(__dirname, "../../../../projects");

export function slugifyProjectTitle(projectTitle = "") {
  return String(projectTitle)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function ensureProjectDir(projectTitle, forgeCtx = {}) {
  const slug = slugifyProjectTitle(projectTitle);
  const projectPath = path.join(PROJECTS_ROOT, slug);
  await ensureForgeProjectDirectory(projectPath, forgeCtx);
  return projectPath;
}

export function getArtifactPath(projectPath, filename) {
  return path.join(projectPath, filename);
}
