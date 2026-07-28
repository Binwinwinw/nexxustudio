/**
 * Validation live — séquence iPhone/Galaxy puis atelier Notion HTML.
 */
import agent from "../src/agent/agent.js";

const IPHONE_QUERY =
  "pourrais tu faire un comparatif entre les derniers modeles d iphone de chez apple et galaxy chez samsung";
const NOTION_QUERY =
  "sais tu créer un atelier d'initiation à l'application NOTION sous forme de fichier html avec header sidebar sur les différents thèmes comme menus?";

async function runTurn(label, query, history) {
  const steps = [];
  const start = Date.now();
  const response = await agent.run(query, history, {
    onStep: (text) => {
      steps.push(text);
      console.log(`[${label}] ${text}`);
    },
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  return { response, steps, elapsed };
}

async function main() {
  console.log("=== TOUR 1 — comparatif iPhone/Galaxy ===");
  const tour1 = await runTurn("T1", IPHONE_QUERY, []);
  const lower1 = tour1.response.toLowerCase();
  console.log("\n--- Réponse T1 (extrait) ---\n", tour1.response.slice(0, 800));

  const history = [
    { role: "user", content: IPHONE_QUERY },
    { role: "assistant", content: tour1.response },
  ];

  console.log("\n=== TOUR 2 — atelier Notion HTML ===");
  const tour2 = await runTurn("T2", NOTION_QUERY, history);
  const lower2 = tour2.response.toLowerCase();

  console.log("\n--- Réponse T2 (extrait) ---\n", tour2.response.slice(0, 1200));

  const checks = {
    t1_has_comparatif: /iphone|galaxy|samsung|apple/i.test(lower1),
    t2_no_smartphone_pollution:
      !/\bsmartphone\b/i.test(tour2.response) &&
      !/informations.*inappropri.*smartphone/i.test(lower2),
    t2_addresses_notion:
      /notion/i.test(lower2) && (/html|sidebar|header|atelier/i.test(lower2)),
    t2_topic_shift_step: tour2.steps.some((s) =>
      /conversation_reset_on_topic_shift|topic_shift/i.test(s),
    ),
    t2_has_html_deliverable: /```html|<!doctype|<html/i.test(tour2.response),
    t2_has_real_sidebar: /<aside[\s>]/i.test(tour2.response),
    t2_has_responsive: /@media\s*\(/i.test(tour2.response),
    t2_rich_modules: (tour2.response.match(/<section[\s>]/gi) || []).length >= 5,
  };

  console.log("\n=== CHECKS ===");
  for (const [k, ok] of Object.entries(checks)) {
    console.log(`${ok ? "✅" : "⚠️"} ${k}`);
  }

  const ok =
    checks.t2_no_smartphone_pollution &&
    checks.t2_addresses_notion &&
    checks.t2_has_html_deliverable &&
    (checks.t2_has_real_sidebar || checks.t2_rich_modules) &&
    !/pas assez d'éléments fiables/i.test(tour2.response);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
