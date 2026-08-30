/**
 * Preuve live HTTP /api/stream — lots E2E_SOCIAL_HTML_NUDGE_SEQUENCE
 * et NAMED_CREATE_WEB_SCOPING_PREEMPT. Runtime déjà up (localhost:3000).
 */
import { randomUUID } from "node:crypto";

const INTERIM = new Set([
  "just_intent_detection",
  "posture_policy",
  "intent_composition_observe",
  "capability_packs_compose",
  "low_token_mode_observe",
]);
/** Delivery INSTANT_RESPONSES["salut"] émet path=instant, pas social_deterministic. */
const T1_OK = new Set(["social_deterministic", "instant"]);
const BASE = process.env.LIVE_BASE_URL || "http://127.0.0.1:3000";
const COOKIE = `nexxus_browser_id=${encodeURIComponent(randomUUID())}`;

const T4 =
  "et bien on va directement attaquer du lourd, as tu des connaissances en html car je voudrais que tu proposes une amélioration de la présentation de mon portefolio. Pourrais tu m'aider??";

const SHAREPOINT =
  "je voudrais créer un site avec sharepoint pourras tu m'aider à faire cela";
const HTML_MEMBER =
  "j'aimerais créer une application de gestion de carte de membre en html n'ayant pas beaucoup de membres on pourra gérer les données avec des json tu pourrais m'aider à le faire ?";
const CARTE = "créer une carte de visite";
const PYTHON =
  "j'aimerais créer un agent IA en langage python tu pourrais m'aider à le faire ?";

async function createSession() {
  const sid = `live-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const res = await fetch(`${BASE}/api/sessions/${sid}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ title: `[live-e2e] ${sid}` }),
  });
  if (!res.ok) {
    throw new Error(`session HTTP ${res.status} ${await res.text()}`);
  }
  return sid;
}

async function turn(sid, q, history, { needReply = true } = {}) {
  const ac = new AbortController();
  const res = await fetch(`${BASE}/api/stream`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: COOKIE },
    body: JSON.stringify({ sessionId: sid, q, history }),
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
  const maybeStop = () => {
    if (dataDone) return true;
    if (!needReply && pipelinePath) return true;
    return false;
  };
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
      if (maybeStop()) {
        ac.abort();
        break;
      }
    }
  } catch (e) {
    if (e.name !== "AbortError") throw e;
  }
  return { path: pipelinePath, reply: String(reply || tokens || "").trim() };
}

function check(name, cond, detail) {
  if (!cond) {
    console.error(`FAIL ${name}: ${detail}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`OK   ${name}`);
  return true;
}

const report = [];

function logTurn(lot, label, expected, got) {
  const row = { lot, label, expectedPath: expected, path: got.path, reply: got.reply.slice(0, 180) };
  report.push(row);
  console.log(`--- ${lot} ${label} ---`);
  console.log(`path=${got.path}`);
  console.log(`reply=${got.reply.slice(0, 180)}`);
  return row;
}

async function lot1() {
  const sid = await createSession();
  const history = [];
  const t1 = await turn(sid, "salut", history);
  logTurn("E2E", "T1 salut", "social_deterministic", t1);
  check("T1 path social", T1_OK.has(t1.path), t1.path);
  check("T1 papoter", /papoter|discut/i.test(t1.reply), t1.reply.slice(0, 80));
  history.push({ role: "user", content: "salut" }, { role: "assistant", content: t1.reply });

  const t2 = await turn(sid, "comment vas tu ?", history);
  logTurn("E2E", "T2 check-in", "social_deterministic", t2);
  check("T2 path social", t2.path === "social_deterministic", t2.path);
  history.push(
    { role: "user", content: "comment vas tu ?" },
    { role: "assistant", content: t2.reply },
  );

  const t3q = "tous tes programmes sont prêt à travailler ?";
  const t3 = await turn(sid, t3q, history);
  logTurn("E2E", "T3 work_ready", "social_deterministic", t3);
  check("T3 path social", t3.path === "social_deterministic", t3.path);
  check("T3 prêt", /prêt|lance/i.test(t3.reply), t3.reply.slice(0, 80));
  history.push({ role: "user", content: t3q }, { role: "assistant", content: t3.reply });

  const t4 = await turn(sid, T4, history);
  logTurn("E2E", "T4 portfolio HTML", "exploratory_conversation_light", t4);
  check("T4 path nudge", t4.path === "exploratory_conversation_light", t4.path);
  check("T4 pas SharePoint", !/SharePoint|intranet|WordPress/i.test(t4.reply), t4.reply);
  check("T4 relance", /présentation|design|structure|responsive/i.test(t4.reply), t4.reply);
  check(
    "T4 pas guided/web",
    t4.path !== "web_project_scoping_clarify" && t4.path !== "guided_creation_scoping",
    t4.path,
  );
}

async function lot2() {
  const sidA = await createSession();
  const a = await turn(sidA, SHAREPOINT, []);
  logTurn("FENCE", "SharePoint vague", "web_project_scoping_clarify", a);
  check("A SharePoint path", a.path === "web_project_scoping_clarify", a.path);
  check("A SharePoint reply", /SharePoint/i.test(a.reply), a.reply.slice(0, 80));

  const sidC = await createSession();
  const c = await turn(sidC, HTML_MEMBER, [], { needReply: false });
  logTurn("FENCE", "carte membre HTML+JSON", "guided_creation_scoping", c);
  check("C guided path", c.path === "guided_creation_scoping", c.path);

  const sidD = await createSession();
  const d = await turn(sidD, CARTE, []);
  logTurn("FENCE", "carte de visite", "named_create_start", d);
  check("D named path", d.path === "named_create_start", d.path);

  const sidF = await createSession();
  const f = await turn(sidF, PYTHON, [], { needReply: false });
  logTurn("FENCE", "agent Python", "guided_creation_scoping", f);
  check("F python guided", f.path === "guided_creation_scoping", f.path);
}

const ping = await fetch(`${BASE}/api/sessions`, { headers: { cookie: COOKIE } });
if (!ping.ok && ping.status !== 400) {
  console.error(`Runtime injoignable ${BASE} HTTP ${ping.status}`);
  process.exit(1);
}

console.log(`LIVE ${BASE}`);
await lot1();
await lot2();
if (process.exitCode) {
  console.error("\nLIVE PARTIEL — voir FAIL ci-dessus");
} else {
  console.log("\nLIVE VERT — 2 lots");
}
