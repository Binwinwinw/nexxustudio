import knowledgeHub from '../src/services/knowledgeHub.js';

const GOLDEN_QUESTIONS_MCS = [
  { q: "comment fonctionne le dashboard élève ?", expected: "src/pages/StudentDashboard.tsx" },
  { q: "quelle est la structure de la base de données (schema) ?", expected: "supabase_schema.sql" },
  { q: "où sont définies les routes de l'application ?", expected: "src/App.tsx" },
  { q: "comment est gérée l'authentification ?", expected: "src/lib/supabase.ts" },
  { q: "où se trouve la page des quizz ?", expected: "src/pages/QuizPage.tsx" },
  { q: "comment fonctionne la page de login ?", expected: "src/pages/LoginPage.tsx" },
  { q: "quel service gère les appels à Supabase ?", expected: "src/lib/supabase.ts" },
  { q: "où est la landing page ?", expected: "src/pages/LandingPage.tsx" },
  { q: "comment fonctionne la génération d'IA ?", expected: "src/lib/ai.ts" },
  { q: "où est le dashboard parent ?", expected: "src/pages/ParentDashboard.tsx" },
  { q: "où est le dashboard prof ?", expected: "src/pages/TeacherDashboard.tsx" },
  { q: "comment sont gérés les résultats de quizz ?", expected: "src/pages/QuizResultPage.tsx" },
  { q: "où est configuré Vite ?", expected: "vite.config.ts" },
  { q: "où est la page de réinitialisation de mot de passe ?", expected: "src/pages/ResetPassword.tsx" },
  { q: "quels sont les styles globaux ?", expected: "src/index.css" }
];

async function runBenchmark() {
  console.log("📊 Lancement du Benchmark MCS v1.1 (Real-Path Audit)...");
  await knowledgeHub.init();

  let top1Hits = 0;
  let top3Hits = 0;
  let top5Hits = 0;

  for (const item of GOLDEN_QUESTIONS_MCS) {
    const results = await knowledgeHub.query(item.q, 5, { project: 'moncoachscolaire' });
    
    const normalize = (p) => p.replace(/\\/g, '/');
    const paths = results.map(r => normalize(r.metadata.source));
    const target = normalize(item.expected);
    
    const hitIndex = paths.findIndex(p => p.includes(target) || target.includes(p));
    
    if (hitIndex === 0) top1Hits++;
    if (hitIndex >= 0 && hitIndex < 3) top3Hits++;
    if (hitIndex >= 0 && hitIndex < 5) top5Hits++;

    console.log(`- Q: "${item.q}" | Found: ${paths[0] || 'NONE'} | Hit: ${hitIndex === -1 ? '❌' : 'Pos ' + (hitIndex + 1)}`);
  }

  const total = GOLDEN_QUESTIONS_MCS.length;
  console.log("\n--- BILAN DE PRÉCISION MCS ---");
  console.log(`Top-1 Accuracy: ${(top1Hits / total * 100).toFixed(1)}%`);
  console.log(`Top-3 Accuracy: ${(top3Hits / total * 100).toFixed(1)}%`);
  console.log(`Top-5 Accuracy: ${(top5Hits / total * 100).toFixed(1)}%`);
}

runBenchmark().catch(console.error);
