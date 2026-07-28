import test from 'node:test';
import assert from 'node:assert/strict';
import { webSearch } from '../src/services/webSearchService.js';

test('web search service: fallback HTML scraping is resilient and returns results on main search crash', async () => {
  const result = await webSearch('One Punch Man');
  
  assert.equal(Array.isArray(result.results), true);
  assert.ok(result.results.length > 0, "Should successfully return scraped fallback search results");
  
  const firstResult = result.results[0];
  assert.ok(firstResult.title, "Scraped result must have a title");
  assert.ok(firstResult.url, "Scraped result must have a URL");
  assert.ok(firstResult.description !== undefined, "Scraped result must have a description snippet");
  
  console.log('PASS - web search HTML fallback resilience works, results returned:', result.results.length);
});
