import knowledgeHub from '../src/services/knowledgeHub.js';

async function test() {
  await knowledgeHub.init();
  const query = "code implementation of expert override in expertRouter.js";
  const r = await knowledgeHub.query(query, 3);
  r.forEach((res, i) => {
    console.log(`[${i}] Distance: ${res.distance.toFixed(3)} | Path: ${res.metadata.source}`);
    console.log(`Snippet: ${res.content.substring(0, 200).replace(/\n/g, ' ')}...`);
  });
}

test().catch(console.error);
