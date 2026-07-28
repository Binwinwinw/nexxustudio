/**
 * Boucle de rétroaction sécurité → Mémoire des Erreurs
 * Exécute security:audit:local ; en cas d'échec, consigne un incident dans le vault.
 *
 * Usage:
 *   node server/src/scripts/security-feedback-loop.js
 *   npm run security:feedback
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { appendAuditHistory } from "../services/securityTelemetryService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const MEMOIRE_PATH = path.join(
  ROOT,
  "citadelle-vault",
  "Citadelle",
  "05-Knowledge",
  "heritage",
  "Memoire-des-Erreurs.md",
);
const INDEX_MARKER = "## Index des Motifs";
const MOTIF = "security_regression";
const MOTIF_ALT = "failed_security_audit";

function runStep(label, command, args, cwd = ROOT) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return {
    label,
    ok: result.status === 0,
    status: result.status ?? 1,
    output: output.slice(-4000),
  };
}

function getGitMeta() {
  const sha = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const branch = spawnSync("git", ["branch", "--show-current"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return {
    sha: sha.status === 0 ? sha.stdout.trim() : "non-git",
    branch: branch.status === 0 ? branch.stdout.trim() : "unknown",
  };
}

function formatDateFr() {
  const d = new Date();
  const jj = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aaaa = d.getFullYear();
  return `${jj}/${mm}/${aaaa}`;
}

function buildIncident({ failures, git }) {
  const dateFr = formatDateFr();
  const failedLabels = failures.map((f) => f.label).join(", ");
  const excerpt = failures
    .map((f) => `#### ${f.label}\n\`\`\`\n${f.output.slice(-1200)}\n\`\`\``)
    .join("\n\n");

  return `
### Incident : ${dateFr} - Régression audit sécurité (commit ${git.sha})

- **Symptôme** : Échec de la chaîne d'audit sécurité avant commit ou en CI locale (\`${failedLabels}\`).
- **Mauvaise Réponse** : N/A (pipeline automatisé) — le dépôt a accepté ou tenté d'accepter un changement sans garde-fous verts.
- **Contexte Manquant** : Exécution de \`npm run security:audit:local\` ou hook pre-commit non effectuée, ou régression introduite sur routes/middlewares/guards.
- **Motif de Rejet** : \`${MOTIF}\` / \`${MOTIF_ALT}\`
- **Signal de Détection** : Exit code non nul sur \`citadel:audit\`, \`test:security\` ou \`quality:gate\` ; sortie capturée ci-dessous.
- **Portée d'Application** : API Express, middlewares session, guards épistémiques, scripts \`security:*\`.
- **Directive Gravée** : *"Aucun commit ne doit être considéré comme certifié local sans PASS sur \`npm run security:audit:local\`. Toute régression doit être corrigée avant merge ; l'incident est consigné dans la Mémoire des Erreurs."*
- **Test Ajouté** : \`server/tests/security-routes.test.js\` + \`npm run citadel:audit\` + \`npm run quality:gate\`
- **Métadonnées** : branche \`${git.branch}\` · commit \`${git.sha}\`

${excerpt}

`;
}

function appendToMemoire(incidentBlock) {
  if (!fs.existsSync(MEMOIRE_PATH)) {
    console.error(`[security-feedback] Fichier introuvable : ${MEMOIRE_PATH}`);
    process.exit(1);
  }

  let content = fs.readFileSync(MEMOIRE_PATH, "utf8");
  const git = getGitMeta();

  if (git.sha !== "non-git" && content.includes(`commit ${git.sha}`)) {
    console.log(
      `[security-feedback] Incident déjà consigné pour le commit ${git.sha} — skip.`,
    );
    return;
  }

  const indexPos = content.indexOf(INDEX_MARKER);
  if (indexPos === -1) {
    content += `\n${incidentBlock}\n`;
  } else {
    content =
      content.slice(0, indexPos) + incidentBlock + "\n" + content.slice(indexPos);
  }

  if (!content.includes(`\`${MOTIF}\``)) {
    content = content.replace(
      INDEX_MARKER,
      `${INDEX_MARKER}\n\n- \`${MOTIF}\`\n- \`${MOTIF_ALT}\``,
    );
  }

  fs.writeFileSync(MEMOIRE_PATH, content, "utf8");
  console.log(`[security-feedback] Incident ajouté → ${MEMOIRE_PATH}`);
}

function main() {
  console.log("\n--- 🔄 NEXXUS SECURITY FEEDBACK LOOP ---\n");

  const steps = [
    runStep("citadel:audit", "npm", ["run", "citadel:audit"], ROOT),
    runStep("test:security", "npm", ["run", "test:security"], path.join(ROOT, "server")),
    runStep("quality:gate", "npm", ["run", "quality:gate"], path.join(ROOT, "server")),
  ];

  const failures = steps.filter((s) => !s.ok);
  const git = getGitMeta();
  const pass = failures.length === 0;

  appendAuditHistory({
    ts: new Date().toISOString(),
    pass,
    git,
    steps: steps.map((s) => ({ label: s.label, ok: s.ok, status: s.status })),
  });

  if (pass) {
    console.log("✅ Audit sécurité : PASS — aucune entrée Mémoire des Erreurs.\n");
    process.exit(0);
  }

  console.error("❌ Audit sécurité : ECHEC — consignation Mémoire des Erreurs.\n");
  failures.forEach((f) => {
    console.error(`  - ${f.label} (exit ${f.status})`);
  });

  appendToMemoire(buildIncident({ failures, git }));

  console.error(
    "\nCorrigez les tests puis relancez : npm run security:audit:local\n",
  );
  process.exit(1);
}

main();
