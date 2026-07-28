import agent from "../src/agent/agent.js";

const queries = [
  "salut salut comment ça va ?",
  "salut salut, fais-moi un CV",
  "ok",
  "on reprend",
  "continue le CV"
];

console.log("=== AUDIT GET_DETERMINISTIC_SOCIAL_RESPONSE ===");
for (const q of queries) {
  // Mocking the behavior we put in intentShortCircuit.js
  const isPure = !q.includes("CV"); // Simplistic mock for the test script
  const reply = agent.getDeterministicSocialResponse(q, [], { bypassDefer: isPure });
  console.log(`\nQuery: "${q}" (isPure: ${isPure})`);
  console.log(`Reply: ${reply}`);
}
