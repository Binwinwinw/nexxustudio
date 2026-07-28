import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import agent from '../src/agent/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BENCHMARK_PATH = path.join(__dirname, 'conversation_benchmarks.json');

async function runBenchmarks() {
  console.log("🚀 Starting Nexxus Conversational Benchmarks...");
  
  const benchmark = JSON.parse(fs.readFileSync(BENCHMARK_PATH, 'utf8'));
  const results = [];
  
  for (const test of benchmark.test_cases) {
    console.log(`\n[TEST ${test.id}] Category: ${test.category}`);
    console.log(`Prompt: "${test.prompt}"`);
    
    try {
      const response = await agent.run(test.prompt, [], { 
        onStep: (s) => console.log(`  - ${s}`),
        disableRecentMemory: true 
      });
      
      const lowerResponse = response.toLowerCase();
      let passed = true;
      const failures = [];
      
      // 1. Check Forbidden Patterns
      for (const pattern of test.forbidden_patterns) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        if (regex.test(response)) {
          passed = false;
          failures.push(`Forbidden pattern detected: "${pattern}"`);
        }
      }
      
      // 2. Check Mandatory Anchors
      for (const anchor of test.mandatory_anchors) {
        if (!lowerResponse.includes(anchor.toLowerCase())) {
          passed = false;
          failures.push(`Missing mandatory anchor: "${anchor}"`);
        }
      }
      
      if (passed) {
        console.log("✅ RESULT: PASS");
      } else {
        console.log("❌ RESULT: FAIL");
        failures.forEach(f => console.log(`   - ${f}`));
      }
      
      results.push({ id: test.id, passed, failures, response });
      
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
      results.push({ id: test.id, passed: false, failures: [error.message] });
    }
  }
  
  const passCount = results.filter(r => r.passed).length;
  console.log(`\n--- FINAL REPORT ---`);
  console.log(`Pass Rate: ${passCount}/${results.length} (${Math.round(passCount/results.length * 100)}%)`);
  
  if (passCount < results.length) {
    process.exit(1);
  }
}

runBenchmarks().catch(console.error);
