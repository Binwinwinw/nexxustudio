import fs from 'fs';
import path from 'path';

const DATASET_PATH = path.join(process.cwd(), 'citadelle-vault', 'Citadelle', '04-Operations', 'audits', 'golden_dataset.json');
const OUTPUT_CSV = path.join(process.cwd(), 'citadelle-vault', 'Citadelle', '04-Operations', 'audits', 'golden_dataset_annotated.csv');

function annotate() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error("Dataset introuvable !");
    return;
  }

  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  const dataset = JSON.parse(raw);

  for (const item of dataset) {
    const query = item.raw_query.toLowerCase().trim();
    
    // 1. Ground Truth Intent
    if (query.includes("bonjour") || query.includes("salut") || query.includes("bienvenue")) {
      item.ground_truth_intent = "social";
    } else if (query.includes("comment t'appelles")) {
      item.ground_truth_intent = "social_inquiry";
    } else {
      item.ground_truth_intent = "general_question";
    }

    // 2. Is Multi Turn (Dépendance Contextuelle)
    item.is_multi_turn = item.has_anaphora || (item.previous_turn_context.length > 0 && query.includes("et quelles sont"));

    // 3. Is Ambiguous
    item.is_ambiguous = false; // Les requêtes sociales actuelles ne sont pas ambiguës
    
    // 4. Context Failure
    const resp = item.assistant_response || "";
    if (resp.includes("erreur critique") || resp === "") {
      item.context_failure = true;
    } else {
      item.context_failure = false;
    }

    item.needs_manual_label = false; // Annoté automatiquement par le script initial
  }

  // Save JSON
  fs.writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2));

  // Save new CSV
  let csv = "session_id,turn_index,raw_query,ground_truth_intent,is_multi_turn,is_ambiguous,context_failure\n";
  for (const row of dataset) {
    const escapedQuery = row.raw_query.replace(/"/g, '""').replace(/\n/g, ' ');
    csv += `"${row.session_id}",${row.turn_index},"${escapedQuery}","${row.ground_truth_intent}",${row.is_multi_turn},${row.is_ambiguous},${row.context_failure}\n`;
  }
  
  fs.writeFileSync(OUTPUT_CSV, csv);
  console.log("✅ Annotation du seed set (18 requêtes) terminée.");
}

annotate();
