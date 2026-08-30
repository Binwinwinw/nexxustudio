/**
 * Preuve live HTTP /api/stream — lot ARCHITECTURE_SMOKE_BOT_RAG_LINTER.
 * Runtime déjà up (localhost:3000).
 */
import { randomUUID } from "node:crypto";

const INTERIM = new Set([
  "just_intent_detection",
  "posture_policy",
  "intent_composition_observe",
  "capability_packs_compose",
  "low_token_mode_observe",
]);
const BASE = process.env.LIVE_BASE_URL || "http://127.0.0.1:3000";
const COOKIE = `nexxus_browser_id=${encodeURIComponent(randomUUID())}`;

const CASES = [
  {
    id: "bot-audit",
    q: "je veux créer un bot assistant qui audite la qualité du code",
    expect: "guided_creation_scoping",
  },
  {
    id: "rag-depot",
    q: "comment mettre en place un agent RAG local pour mon dépôt",
    expect: "architecture_design_deterministic",
  },
  {
    id: "linter-repo",
    q: "propose moi plusieurs approches pour un linter intelligent sur mon repo",
    expect: "architecture_design_deterministic",
  },
  {
    id: "carte-visite",
    q: "créer une carte de visite",
    expect: "named_create_start",
  },
  {
    id: "sharepoint",
    q: "je voudrais créer un site avec sharepoint pourras tu m'aider à faire cela",
    expect: "web_project_scoping_clarify",
  },
  {
    id: "python-agent",
    q: "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?",
    expect: "guided_creation_scoping",
  },
  {
    id: "ideation-ouverte",
    q: "Quel projet IA je pourrais lancer ?",
    expect: "ideation_deterministic",
  },
];

async function createSession() {
  const sid = `live-arch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await fetch(`${BASE}/api/sessions/${sid}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ title: `[live-arch] ${sid}` }),
  });
  if (!res.ok) {
    throw new Error(`session HTTP ${res.status} ${await res.text()}`);
  }
  return sid;
}

async function turn(sid, q) {
  const ac = new AbortController();
  const res = await fetch(`${BASE}/api/stream`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ sessionId: sid, q, history: [] }),
    signal: ac.signal,
  });
  if (!res.ok) {
    throw new Error(`stream HTTP ${res.status} ${await res.text()}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let pipelinePath = null;
  let reply = "";
  let tokens = "";
  let dataDone = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const block of parts) {
        const line = block.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          dataDone = true;
          continue;
        }
        let data;
        try {
          data = JSON.parse(payload);
        } catch {
          continue;
        }
        if (data.meta?.pipelinePath && !INTERIM.has(data.meta.pipelinePath)) {
          pipelinePath = data.meta.pipelinePath;
        }
        if (data.pipeline_path && !INTERIM.has(data.pipeline_path)) {
          pipelinePath = data.pipeline_path;
        }
        if (data.token) tokens += data.token;
        if (data.result) reply = data.result;
        if (data.done) {
          dataDone = true;
          if (data.result) reply = data.result;
        }
      }
      if (dataDone && pipelinePath) {
        ac.abort();
        break;
      }
    }
  } catch (e) {
    if (e.name !== "AbortError") throw e;
  }
  return { path: pipelinePath, reply: String(reply || tokens || "").trim() };
}

let failed = 0;
for (const c of CASES) {
  const sid = await createSession();
  const got = await turn(sid, c.q);
  const ok = got.path === c.expect;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "OK" : "FAIL"} ${c.id} expect=${c.expect} got=${got.path} reply=${got.reply.slice(0, 120)}`,
  );
}
if (failed) {
  console.error(`live-architecture-smoke FAIL ${failed}/${CASES.length}`);
  process.exit(1);
}
console.log(`live-architecture-smoke OK ${CASES.length}/${CASES.length}`);
