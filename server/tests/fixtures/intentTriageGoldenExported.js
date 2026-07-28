/**
 * AUTO-GENERATED — Ne pas éditer à la main.
 * Source : D:/Hostinger/public_html/nexxustudio/server/data/intent-triage/clarification-feedback.jsonl
 * Export : 2026-06-06
 * Commande : npm run triage:export-golden
 */
import { EXPORT_CATEGORIES } from "../../src/agent/classifiers/intentTriageFeedbackExporter.js";

/** @type {import("../../src/agent/classifiers/intentTriageFeedbackExporter.js").IntentTriageGoldenCase[]} */
export const INTENT_TRIAGE_EXPORTED_QUERIES = [
  {
    "id": "baseline-calculatrice-code-review-high",
    "category": "production_routing",
    "observedAt": "2026-05-27",
    "query": "analyse le code suivant c'est du python :\nCalculatrice simple\nExécutez avec : python calculatrice.py\ndef addition(a, b): return a + b\ndef soustraction(a, b): return a - b\ndef multiplication(a, b): return a * b\ndef division(a, b): if b == 0: return \"Erreur : division par zéro\" return a / b\ndef calculatrice(): print(\"=== Calculatrice ===\") print(\"1. Addition\") print(\"2. Soustraction\") print(\"3. Multiplication\") print(\"4. Division\") print(\"5. Quitter\")\nwhile True:\ntry:\nchoix = input(\"\\nVotre choix (1-5) : \")\nif choix == '5':\nprint(\"Au revoir !\")\nbreak\nif choix in ('1', '2', '3', '4'):\na = float(input(\"Premier nombre : \"))\nb = float(input(\"Deuxième nombre : \"))\nif choix == '1':\nprint(f\"Résultat : {addition(a, b)}\")\nelif choix == '2':\nprint(f\"Résultat : {soustraction(a, b)}\")\nelif choix == '3':\nprint(f\"Résultat : {multiplication(a, b)}\")\nelif choix == '4':\nprint(f\"Résultat : {division(a, b)}\")\nelse:\nprint(\"Choix invalide\")\nexcept ValueError:\nprint(\"Erreur : veuillez entrer des nombres valides\")\nif name == \"main\": calculatrice()",
    "expectedTopIntent": "code_review",
    "minConfidence": "high",
    "routingAction": "route_direct",
    "incident": "Incident terrain : formulation « analyse » + snippet Python → ne doit pas router vers document_analysis.",
    "source": "baseline"
  },
  {
    "id": "baseline-explain-vs-review",
    "category": "production_routing",
    "observedAt": "2026-05-27",
    "query": "Explique ce code Python : def addition(a, b): return a + b\nprint(addition(1,2))",
    "expectedTopIntent": "code_explain",
    "minConfidence": "high",
    "routingAction": "route_direct",
    "source": "baseline"
  },
  {
    "id": "baseline-explicit-code-review-phrase",
    "category": "production_routing",
    "observedAt": "2026-05-27",
    "query": "Fais une revue de code Python orientée exécution : commence par les erreurs bloquantes.\ndef broken( return 1",
    "expectedTopIntent": "code_review",
    "minConfidence": "high",
    "routingAction": "route_direct",
    "source": "baseline"
  },
  {
    "id": "baseline-resume-sans-code",
    "category": "production_routing",
    "observedAt": "2026-05-27",
    "query": "Résume ce passage et extrais les points clés :\n\nLa Citadelle est un système local-first conçu pour l'orchestration souveraine.",
    "expectedTopIntent": "document_analysis",
    "minConfidence": "high",
    "routingAction": "route_direct",
    "source": "baseline"
  }
];

export { EXPORT_CATEGORIES };
