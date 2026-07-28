import assert from 'node:assert/strict';

import { looksTruncatedResponse, isIllusionOfCompleteness } from '../src/agent/utils/qualityGuards.js';

function run() {
  {
    const query = "pour 4heures car en 1 heure on ne peut pas vraiment faire d'exercices afin au moins de découvrir l'application";
    const response = "Plan d'Atelier Teams - 4 Heures\n## Objectifs Pédagogiques\n- Comprendre Teams\n## Déroulé Détaillé\n| Temps | Phase | Contenu | Support Animateur |\n|-------|-------|---------|-------------------|\n| 00-10 min | Accueil & Cadrage | Présentation des objectifs, règles d'atelier";
    assert.equal(looksTruncatedResponse(query, response), true);
  }

  {
    const query = "prépare le plan d'atelier de 4heures avec objectifs, déroulé, exercices et support animateur";
    const response = [
      "Plan d'atelier Teams - 4 heures",
      "",
      "## Objectifs",
      "- Découvrir l'interface",
      "- Réaliser des exercices guidés",
      "",
      "## Déroulé",
      "- 00-30 min : accueil et prise en main",
      "- 30-90 min : navigation et messages",
      "- 90-150 min : réunions et exercices",
      "- 150-210 min : fichiers et coédition",
      "- 210-240 min : synthèse, questions, ressources",
      "",
      "## Support animateur",
      "- Prévoir un espace de démonstration",
      "- Préparer les supports et le quiz final",
      "",
      "## Clôture",
      "- Questions-réponses et ressources complémentaires."
    ].join('\n');
    assert.equal(looksTruncatedResponse(query, response), false);
  }

  {
    // Test 1: Fichier complet demandé, mais résumé fourni (Illusion)
    const query = "Crée un fichier index.html avec l'atelier complet de 20 slides pour Teams 365.";
    const response = "Voici une synthèse de ce que contient le fichier :\n- Introduction\n- Canaux\n- Réunions\n- Conclusion.\nEn résumé, ce code crée la structure.";
    assert.equal(isIllusionOfCompleteness(query, response), true);
  }

  {
    // Test 2: Demande purement stratégique/plan (Pas d'artefact forcé)
    const query = "Crée un plan d'architecture pour le fichier index.html complet de 20 slides.";
    const response = "Voici la structure proposée pour le fichier HTML :\n- Header\n- 20 slides (1 par thème)\n- Footer.";
    assert.equal(isIllusionOfCompleteness(query, response), false);
  }

  {
    // Test 3: Requête hybride avec exécution complète
    const query = "Crée un fichier complet index.html de 20 slides.";
    // On simule une longue réponse HTML avec suffisamment d'éléments (mock)
    let response = "Voici le code complet :\n<!doctype html>\n<html>\n<body>\n";
    for(let i=1; i<=20; i++) response += `<section id="slide-${i}">## Titre ${i}</section>\n`;
    response += "</body></html>";
    // Même si "Voici le code complet" est présent, la structure est là et le compte y est
    assert.equal(isIllusionOfCompleteness(query, response), false);
  }

  console.log('response completeness regression checks passed');
}

run();
