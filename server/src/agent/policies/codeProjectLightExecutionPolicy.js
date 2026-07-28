/**
 * Post-compose — application CODE_PROJECT_LIGHT (extraction + gate qualité + writer).
 */
import {
  extractCodeProjectLightSlots,
  isCodeProjectLightRequest,
} from "./codeProjectLightPolicy.js";
import {
  resolveHtmlTrioArtifacts,
  writeCodeProjectLightArtifacts,
  buildCodeProjectLightWriteSummary,
} from "./codeProjectLightWriter.js";
import { validateCodeProjectLightArtifacts } from "./frontendPresentationQualityContract.js";

/**
 * @param {string} query
 * @param {string} reply
 * @param {{ sessionId?: string, slots?: ReturnType<typeof extractCodeProjectLightSlots> }} [context]
 * @returns {Promise<{
 *   applied: boolean,
 *   reply: string,
 *   written?: Array<{ path: string, bytes: number }>,
 *   targetDir?: string,
 *   error?: string,
 *   mode?: string,
 *   quality?: ReturnType<typeof validateCodeProjectLightArtifacts>,
 * }>}
 */
export async function applyCodeProjectLightWrite(query = "", reply = "", context = {}) {
  if (!isCodeProjectLightRequest(query)) {
    return { applied: false, reply };
  }

  const resolved = resolveHtmlTrioArtifacts(reply);
  if (!resolved?.files) {
    console.warn("[CODE_PROJECT_LIGHT] trio_html_css_js_incomplete — aucun HTML extractible");
    return {
      applied: false,
      reply: `${reply.trim()}\n\n---\n**Enregistrement non effectué** — le trio \`index.html\` / \`style.css\` / \`app.js\` n'a pas pu être extrait de la réponse. Relance en demandant explicitement les 3 fichiers séparés (format 📁).`,
      error: "trio_html_css_js_incomplete",
      quality: {
        passFormat: false,
        passPresentation: false,
        quality: "fail",
        score: 0,
        reasons: ["trio_html_css_js_incomplete"],
        checks: {},
      },
    };
  }

  const quality = validateCodeProjectLightArtifacts(resolved.files);
  console.log(
    `[CODE_PROJECT_LIGHT] quality → score=${quality.score} format=${quality.passFormat} presentation=${quality.passPresentation} quality=${quality.quality}`,
  );

  if (!quality.passFormat) {
    console.warn(
      `[CODE_PROJECT_LIGHT] write blocked — pass_format=false reasons=${quality.reasons.join(" | ")}`,
    );
    return {
      applied: false,
      reply: [
        reply.trim(),
        "---",
        "**Enregistrement non effectué** — `pass_format` échoué.",
        `Score présentation : ${quality.score}/100.`,
        ...quality.reasons.map((r) => `- ${r}`),
        "Relance en demandant un trio complet (HTML + CSS substantiel + JS vivant).",
      ].join("\n"),
      error: "pass_format_failed",
      mode: resolved.mode,
      quality,
    };
  }

  const slots = context.slots || extractCodeProjectLightSlots(query);

  try {
    console.log(
      `[CODE_PROJECT_LIGHT] write → dir=${slots.targetDir} mode=${resolved.mode} quality=${quality.quality}`,
    );
    const result = await writeCodeProjectLightArtifacts(slots.targetDir, resolved.files, {
      sessionId: context.sessionId,
    });
    let summary = buildCodeProjectLightWriteSummary({
      ...result,
      mode: resolved.mode,
    });
    summary += `\n\nQualité composition : \`${quality.quality}\` (score ${quality.score}/100 · pass_format=${quality.passFormat} · pass_presentation=${quality.passPresentation}).`;
    if (quality.quality === "fail") {
      summary += `\n_Écrit malgré présentation insuffisante — raisons : ${quality.reasons.slice(0, 3).join(" ; ")}_`;
    }
    return {
      applied: true,
      reply: summary,
      written: result.written,
      targetDir: result.targetDir,
      mode: resolved.mode,
      quality,
    };
  } catch (err) {
    console.warn(`[CODE_PROJECT_LIGHT] write failed: ${err.message}`);
    return {
      applied: false,
      reply: `${reply.trim()}\n\n---\n**Échec enregistrement fichiers** : ${err.message}`,
      error: err.message,
      mode: resolved.mode,
      quality,
    };
  }
}
