/**
 * Contrat table pédagogique — partagé serveur (validation) / client (rendu UI).
 */

export const PEDAGOGICAL_TABLE_HEADERS = [
  "Étape",
  "Description",
  "Résultat / Exemple",
];

/**
 * Valide une réponse Markdown contre un Response Contract table.
 * @param {string} text
 * @param {{ minRows?: number, headers?: string[] }} [contract]
 * @returns {{ ok: boolean, failures: string[], rowCount: number }}
 */
export function validatePedagogicalTableResponse(text = "", contract = {}) {
  const failures = [];
  const body = String(text || "");
  const minRows = Number(contract.minRows) > 0 ? Number(contract.minRows) : 5;
  const expectedHeaders =
    Array.isArray(contract.headers) && contract.headers.length
      ? contract.headers
      : PEDAGOGICAL_TABLE_HEADERS;

  const lines = body.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const next = lines[i + 1].trim();
    if (/^\|.+\|$/.test(line) && /^\|?\s*:?-{3,}/.test(next)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    failures.push("contains_table");
    return { ok: false, failures, rowCount: 0 };
  }

  const parseCells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim().replace(/\s+/g, " "));

  const normalizeHeader = (h) =>
    String(h || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s*\/\s*/g, "/")
      .replace(/\s+/g, " ")
      .trim();

  const headers = parseCells(lines[headerIdx]);
  const headersOk = expectedHeaders.every((want, i) => {
    const cell = normalizeHeader(headers[i]);
    const target = normalizeHeader(want);
    return cell === target || cell.includes(target) || target.includes(cell);
  });
  if (!headersOk || headers.length < expectedHeaders.length) {
    failures.push("header_equals");
  }

  let rowCount = 0;
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) break;
    if (!/^\|.+\|$/.test(line)) break;
    if (/^\|?\s*:?-{3,}/.test(line)) continue;
    rowCount += 1;
  }
  if (rowCount < minRows) failures.push("row_count");

  const trimmed = body.trim();
  if (
    /…\s*$/.test(trimmed) ||
    /\.\.\.\s*$/.test(trimmed) ||
    /(?:des|les|une|un|de|du|la|le|et|ou|sous|effet)\s*$/i.test(trimmed)
  ) {
    failures.push("no_truncated_tokens");
  }

  return { ok: failures.length === 0, failures, rowCount };
}

function parsePedagogicalMetaLines(afterLines = []) {
  let note = "";
  let takeaway = "";
  let sources = "";
  const rest = [];

  const stripMd = (s) =>
    String(s || "")
      .replace(/^\*+|\*+$/g, "")
      .replace(/^\*\*|\*\*$/g, "")
      .trim();
  const isNoteLine = (t) => /^\*+?Note\s*:\*?/i.test(t) || /^Note\s*:/i.test(t);
  const isTakeawayLine = (t) =>
    /^(?:\*\*)?À retenir(?:\*\*)?\s*:/i.test(t) || /^\*\*À retenir\*\*/i.test(t);
  const isSourcesHeading = (t) =>
    /^(?:\*\*)?Sources?(?:\*\*)?\s*:?\s*$/i.test(t) || /^Sources?\s*:/i.test(t);
  const isBlockBoundary = (t) =>
    /^---+$/.test(t) || /^#{1,3}\s+\d+\./.test(t);

  let mode = "rest";
  for (const raw of afterLines) {
    const t = raw.trim();
    if (isBlockBoundary(t)) break;
    if (!t && mode === "sources") {
      sources += (sources ? "\n" : "") + raw;
      continue;
    }
    if (!t) {
      if (mode === "note" && note) continue;
      if (mode === "takeaway" && takeaway) continue;
      rest.push(raw);
      continue;
    }

    if (isSourcesHeading(t)) {
      mode = "sources";
      const inline = stripMd(t.replace(/^(?:\*\*)?Sources?(?:\*\*)?\s*:?\s*/i, ""));
      sources = inline;
      continue;
    }
    if (isNoteLine(t)) {
      mode = "note";
      note = t
        .replace(/^\*Note\s*:\*\s*/i, "")
        .replace(/^Note\s*:\s*/i, "")
        .replace(/^\*+\s*Note\s*:\*?\s*/i, "")
        .replace(/\*+$/g, "")
        .trim();
      continue;
    }
    if (isTakeawayLine(t)) {
      mode = "takeaway";
      takeaway = t
        .replace(/^\*\*À retenir\*\*\s*:?\s*/i, "")
        .replace(/^À retenir\s*:?\s*/i, "")
        .trim();
      continue;
    }

    if (mode === "note") {
      note = `${note} ${t}`.trim();
      continue;
    }
    if (mode === "takeaway") {
      takeaway = `${takeaway} ${t}`.trim();
      continue;
    }
    if (mode === "sources") {
      sources = sources ? `${sources}\n${raw}` : raw;
      continue;
    }
    rest.push(raw);
  }

  if (!note || !takeaway) {
    const restText = rest.join("\n");
    if (!note) {
      const m = restText.match(/\*?Note\s*:\*?\s*([^\n]+)/i);
      if (m) note = m[1].replace(/\*+/g, "").trim();
    }
    if (!takeaway) {
      const m = restText.match(/\*\*À retenir\*\*\s*:?\s*([^\n]+)/i);
      if (m) takeaway = m[1].trim();
    }
  }

  return {
    note: note.trim(),
    takeaway: takeaway.trim(),
    sources: sources.trim(),
  };
}

/**
 * Découpe une réponse (1 ou N tableaux) en blocs UI.
 * @param {string} text
 * @returns {{
 *   isPedagogical: boolean,
 *   blocks: Array<{ intro: string, tableMd: string, note: string, takeaway: string, sources: string }>,
 *   preamble: string,
 * }}
 */
export function splitPedagogicalMarkdownBlocks(text = "") {
  const empty = { isPedagogical: false, blocks: [], preamble: "" };
  const body = String(text || "").trim();
  if (!body || !/^\|.+\|\s*$/m.test(body)) return empty;

  const lines = body.split(/\r?\n/);
  const ranges = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const next = lines[i + 1].trim();
    if (/^\|.+\|$/.test(line) && /^\|?\s*:?-{3,}/.test(next)) {
      let end = i + 1;
      for (let j = i + 2; j < lines.length; j++) {
        if (/^\|.+\|$/.test(lines[j].trim())) end = j;
        else break;
      }
      ranges.push({ start: i, end });
      i = end;
    }
  }
  if (!ranges.length) return empty;

  const blocks = [];
  for (let t = 0; t < ranges.length; t++) {
    const range = ranges[t];
    const prevEnd = t === 0 ? 0 : ranges[t - 1].end + 1;
    const nextStart = t + 1 < ranges.length ? ranges[t + 1].start : lines.length;
    const before = lines.slice(prevEnd, range.start).join("\n").trim();
    const tableMd = lines.slice(range.start, range.end + 1).join("\n").trim();
    const afterLines = lines.slice(range.end + 1, nextStart);
    const meta = parsePedagogicalMetaLines(afterLines);
    blocks.push({
      intro: before.replace(/^---+\s*/, "").trim(),
      tableMd,
      note: meta.note,
      takeaway: meta.takeaway,
      sources: meta.sources,
    });
  }

  const preamble =
    ranges[0].start > 0
      ? lines.slice(0, ranges[0].start).join("\n").trim()
      : "";
  // preamble déjà dans blocks[0].intro — garder seulement une intro globale courte si multi
  const globalPreamble =
    blocks.length > 1 && /tableaux pédagogiques/i.test(blocks[0].intro)
      ? blocks[0].intro.split(/\n###/)[0].trim()
      : blocks.length > 1
        ? preamble.split(/\n###/)[0].trim()
        : "";

  if (blocks.length > 1 && globalPreamble) {
    // Retirer le préambule global du premier intro (garder ### N. …)
    const first = blocks[0].intro;
    if (first.startsWith(globalPreamble)) {
      blocks[0] = {
        ...blocks[0],
        intro: first.slice(globalPreamble.length).replace(/^\s*\n+/, "").trim(),
      };
    }
  }

  return {
    isPedagogical: true,
    blocks,
    preamble: blocks.length > 1 ? globalPreamble : "",
  };
}

/**
 * Découpe une réponse table pédagogique en un bloc UI (compat).
 * @param {string} text
 * @returns {{
 *   isPedagogical: boolean,
 *   intro: string,
 *   tableMd: string,
 *   note: string,
 *   takeaway: string,
 *   sources: string,
 * }}
 */
export function splitPedagogicalMarkdown(text = "") {
  const multi = splitPedagogicalMarkdownBlocks(text);
  if (!multi.isPedagogical || !multi.blocks.length) {
    return {
      isPedagogical: false,
      intro: "",
      tableMd: "",
      note: "",
      takeaway: "",
      sources: "",
    };
  }
  const first = multi.blocks[0];
  const intro =
    multi.preamble && first.intro
      ? `${multi.preamble}\n\n${first.intro}`.trim()
      : multi.preamble || first.intro;
  return {
    isPedagogical: true,
    intro,
    tableMd: first.tableMd,
    note: first.note,
    takeaway: first.takeaway,
    sources: first.sources,
  };
}
