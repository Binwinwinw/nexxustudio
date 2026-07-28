import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";

let tempRoot = "";
let pathGuards;
let artifactWriter;
let artifactService;
let artifactCleanup;
let RUNS_ROOT;

before(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "citadelle-artifacts-"));
  process.env.NEXXUS_ARTIFACT_RUNS_ROOT = tempRoot;

  pathGuards = await import("../src/services/artifacts/artifactPathGuards.js");
  artifactWriter = await import("../src/services/artifacts/artifactWriter.js");
  artifactService = await import("../src/services/artifacts/artifactService.js");
  artifactCleanup = await import("../src/services/artifacts/artifactCleanup.js");
  ({ RUNS_ROOT } = await import("../src/services/artifacts/artifactConstants.js"));
});

after(async () => {
  delete process.env.NEXXUS_ARTIFACT_RUNS_ROOT;
  await fs.rm(tempRoot, { recursive: true, force: true });
});

describe("artifact P0 — guards", () => {
  it("rejette les chemins traversal", () => {
    assert.equal(pathGuards.validateArtifactRelativePath("../secret.md").ok, false);
    assert.equal(pathGuards.validateArtifactRelativePath("ok/readme.md").ok, true);
  });

  it("résout un chemin sous output sans sortir du sandbox", () => {
    const out = path.join(tempRoot, "sess", "run", "output");
    const { absolutePath, relativePath } = pathGuards.resolveArtifactOutputPath(
      out,
      "docs/readme.md",
    );
    assert.equal(relativePath, "docs/readme.md");
    assert.ok(absolutePath.startsWith(path.resolve(out)));
  });
});

describe("artifact P0 — writer / service", () => {
  it("écrit un run, manifest et registry", async () => {
    const sessionId = "sess-p0-test";
    const result = await artifactWriter.writeRunFromDraft({
      sessionId,
      files: [
        { path: "project-brief.md", content: "# Brief\nContenu test." },
        { path: "README.md", content: "# README\nHello." },
      ],
      bundle: "zip",
      contractId: "FORGE_WEBAPP_BUILD",
    });

    assert.equal(result.artifacts.length, 3);
    assert.ok(result.artifacts.some((a) => a.name === "scaffold.zip"));
    assert.ok(result.artifacts.every((a) => a.downloadUrl.includes("/download")));

    const runs = await artifactService.listRunsForSession(sessionId);
    assert.equal(runs.length, 1);

    const manifest = await artifactService.loadRunManifest(sessionId, result.runId);
    assert.equal(manifest.artifacts.length, 3);
    assert.ok(manifest.expiresAt);
  });

  it("stream download sans charger tout le fichier en mémoire", async () => {
    const sessionId = "sess-p0-stream";
    const { artifacts } = await artifactWriter.writeRunFromDraft({
      sessionId,
      files: [{ path: "notes.txt", content: "stream-check-ok" }],
    });

    const resolved = await artifactService.resolveArtifactForAccess(artifacts[0].id);
    assert.equal(resolved.ok, true);

    const stream = artifactService.createArtifactDownloadStream(resolved.absolutePath);
    const chunks = [];
    for await (const chunk of Readable.from(stream)) {
      chunks.push(chunk);
    }
    assert.match(Buffer.concat(chunks).toString("utf8"), /stream-check-ok/);
  });

  it("preview renvoie le texte pour markdown", async () => {
    const sessionId = "sess-p0-preview";
    const { artifacts } = await artifactWriter.writeRunFromDraft({
      sessionId,
      files: [{ path: "doc.md", content: "## Titre\nCorps" }],
    });

    const resolved = await artifactService.resolveArtifactForAccess(artifacts[0].id);
    const preview = await artifactService.readArtifactPreview(
      resolved.absolutePath,
      "text/markdown",
    );
    assert.match(preview.content, /Titre/);
    assert.equal(preview.truncated, false);
  });
});

describe("artifact P0 — ZIP interop", () => {
  it("scaffold.zip lisible par le parseur PKZIP interne (central directory)", async () => {
    const { buildStoredZipArchive } = await import("../src/services/artifacts/artifactZip.js");
    const { extractArchiveToText } = await import(
      "../src/services/document-analysis/archiveExtractor.js"
    );

    const zip = buildStoredZipArchive({
      "project-brief.md": "# Brief",
      "README.md": "# README",
    });

    const extracted = extractArchiveToText(zip, "scaffold.zip");
    assert.match(extracted.text, /project-brief\.md/);
    assert.match(extracted.text, /README\.md/);
    assert.equal(extracted.fileCount, 2);
  });
});

describe("artifact P0 — TTL purge", () => {
  it("purge les runs expirés", async () => {
    const sessionId = "sess-p0-ttl";
    const { runId } = await artifactWriter.writeRunFromDraft({
      sessionId,
      files: [{ path: "brief.md", content: "expire me" }],
    });

    const manifestPath = path.join(RUNS_ROOT, sessionId, runId, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.expiresAt = new Date(Date.now() - 60_000).toISOString();
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const { removed } = await artifactCleanup.purgeExpiredRuns();
    assert.ok(removed >= 1);

    const after = await artifactService.loadRunManifest(sessionId, runId);
    assert.equal(after, null);
  });
});
