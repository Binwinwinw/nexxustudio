import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

import sessionStore from "../src/services/sessionStore.js";
import {
  SESSION_WORK_MEMORY_DIR,
  loadSessionWorkMemory,
  saveSessionWorkMemory,
  createEmptySessionWorkMemory,
  clearSessionWorkMemoryForTests,
} from "../src/agent/memory/sessionWorkMemory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const STATE_SESSIONS = path.join(SERVER_ROOT, "state", "sessions");

describe("server/state sessions (vague 4a)", () => {
  it("chemins state résolus (pas data/)", () => {
    assert.match(STATE_SESSIONS.replace(/\\/g, "/"), /\/state\/sessions$/);
    assert.match(SESSION_WORK_MEMORY_DIR.replace(/\\/g, "/"), /\/state\/session-work-memory$/);
    assert.equal(fs.existsSync(path.join(SERVER_ROOT, "data", "sessions")), false);
    assert.equal(fs.existsSync(path.join(SERVER_ROOT, "data", "session-work-memory")), false);
  });

  it("lecture d'une session existante si présente", async () => {
    await fs.ensureDir(STATE_SESSIONS);
    const files = (await fs.readdir(STATE_SESSIONS)).filter((f) => f.endsWith(".json"));
    const id = files.length > 0 ? path.basename(files[0], ".json") : "smoke-state-session-tmp";

    if (files.length === 0) {
      await sessionStore.saveSession(id, {
        title: "smoke",
        createdAt: new Date().toISOString(),
        messages: [],
      });
    }

    const session = await sessionStore.getSession(id);
    assert.ok(session);
    assert.equal(session.id, id);

    if (files.length === 0) {
      await sessionStore.deleteSession(id);
    }
  });

  it("dossier sessions vide : ensureDir + write/read sans ancien contenu", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "citadel-state-sessions-"));
    const emptySessions = path.join(tmpRoot, "sessions");
    assert.equal(await fs.pathExists(emptySessions), false);
    await fs.ensureDir(emptySessions);
    assert.equal(await fs.pathExists(emptySessions), true);
    const probe = path.join(emptySessions, "empty-probe.json");
    await fs.writeJson(probe, { id: "empty-probe", title: "ok" });
    const read = await fs.readJson(probe);
    assert.equal(read.id, "empty-probe");
    await fs.remove(tmpRoot);
  });

  it("session-work-memory : ensureDir implicite à l'écriture", () => {
    const sid = "smoke-swm-ensure-dir";
    clearSessionWorkMemoryForTests(sid);
    const empty = createEmptySessionWorkMemory(sid);
    saveSessionWorkMemory(empty);
    assert.equal(fs.existsSync(SESSION_WORK_MEMORY_DIR), true);
    const loaded = loadSessionWorkMemory(sid);
    assert.equal(loaded.sessionId, sid);
    clearSessionWorkMemoryForTests(sid);
  });
});
