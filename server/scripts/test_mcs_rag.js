
import hub from '../src/services/knowledgeHub.js';

async function testMCSRag() {
  console.log("🔍 Test du Recall Pilote MonCoachScolaire...");
  
  const queries = [
    { q: "Quelle est l'architecture de MonCoachScolaire ?", project: 'moncoachscolaire' },
    { q: "Quelles sont les tables Supabase pour MCS ?", project: 'moncoachscolaire' },
    { q: "Qui est Nexxus ?", project: 'citadel' }
  ];

  for (const item of queries) {
    console.log(`\n[Query] "${item.q}" (Filter: project=${item.project})`);
    const results = await hub.query(item.q, 3, { project: item.project });
    
    if (results.length > 0) {
      results.forEach((r, i) => {
        console.log(`  Match ${i+1}: ${r.metadata.title} [Score: ${(1-r.distance).toFixed(3)}]`);
        console.log(`    Content: ${r.content.substring(0, 100)}...`);
      });
    } else {
      console.log("  ❌ Aucun résultat.");
    }
  }
}

testMCSRag();
