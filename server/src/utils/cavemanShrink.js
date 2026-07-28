/**
 * NEXXUS CAVE-SHRINK ENGINE v2.0 (Industrial Refactor)
 * Hardened semantic compression for LLM tokens.
 */

const STOP_WORDS_EN = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 
  'at', 'from', 'by', 'for', 'with', 'about', 'against', 'between', 
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 
  'to', 'of', 'in', 'on', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'just', 'actually', 'basically',
  'simply', 'really', 'very', 'quite', 'somewhat', 'rather', 'extremely',
  'please', 'thank', 'thanks', 'hello', 'hi', 'hey', 'regards', 'sincerely',
  'maybe', 'might', 'could', 'possibly', 'potentially', 'perhaps'
]);

const STOP_WORDS_FR = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'mais', 'si', 'alors', 'quand',
  'à', 'de', 'par', 'pour', 'avec', 'dans', 'sur', 'chez', 'est', 'sont', 'était', 'étaient',
  'avoir', 'a', 'ont', 'eu', 'fait', 'font', 'juste', 'vraiment', 'très', 'plus', 'moins',
  'donc', 'car', 'puis', 'voici', 'voilà', 'merci', 'bonjour', 'salut', "s'il vous plaît"
]);


const INTENSITY = {
  LITE: 'lite',
  FULL: 'full',
  ULTRA: 'ultra',
  WENYAN: 'wenyan'
};

// Sigles et identifiants techniques courts protégés (ULTRA)
const PROTECTED_SHORT_TOKENS = new Set([
  'c', 'c#', 'c++', 'go', 'ai', 'ia', 'ui', 'ux', 'db', 'fr', 'en', 'v1', 'v2', 'v3',
  'id', 'io', 'ip', 'os', 'vm', 'fs', 'ws', 'l1', 'l2', 'l3'
]);

/**
 * Shrinks text while preserving technical tokens.
 * @param {string} text 
 * @param {string} level 
 * @returns {string}
 */
export function shrink(text, level = INTENSITY.FULL) {
  if (!text || typeof text !== 'string') return text;

  if (level === INTENSITY.WENYAN) return shrink(text, INTENSITY.ULTRA);

  // 1. Placeholder Strategy (Anti-Collision Sentinels)
  const sentinelPrefix = `__NS_${Math.random().toString(36).substring(2, 7).toUpperCase()}_`;
  const technicals = [];
  
  const protect = (regex) => {
    text = text.replace(regex, (match) => {
      technicals.push(match);
      return `${sentinelPrefix}${technicals.length - 1}__`;
    });
  };

  // 2. Sequential Preservation Passes
  // a) Code Blocks & Inline Code
  protect(/```[\s\S]*?```/g);
  protect(/`[^`]+`/g);
  // b) URLs
  protect(/https?:\/\/[^\s$.?#].[^\s]*/g);
  // c) Windows/Unix Paths (Enhanced)
  protect(/([a-zA-Z]:\\[\\\w\s.-]+|(?:\/|\\)[\w\s.-]+(?:\/|\\)[\w\s.-]+)/g);
  // d) Identifiers (CamelCase, snake_case, versioning)
  protect(/\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g);
  protect(/\b[a-zA-Z0-9]+(_[a-zA-Z0-9]+)+\b/g);
  protect(/\bv\d+(\.\d+)*\b/g);

  let processed = text;

  // 3. Compression Logic
  if (level === INTENSITY.LITE) {
    // Lite: Only remove filler words and hedging (EN + FR)
    const fillers = /\b(actually|basically|simply|really|very|quite|somewhat|rather|extremely|maybe|might|could|possibly|potentially|perhaps|vraiment|juste|tellement|plutôt|plutot)\b/gi;
    processed = processed.replace(fillers, '');
  } else {
    // Full/Ultra: Aggressive token filtering
    const words = processed.split(/\s+/);
    const filtered = words.filter(word => {
      // Don't filter placeholders
      if (word.startsWith(sentinelPrefix)) return true;

      const lower = word.toLowerCase().replace(/[.,!?;:]/g, '');
      if (!lower) return true;

      const isStopWord = STOP_WORDS_EN.has(lower) || STOP_WORDS_FR.has(lower);
      
      if (level === INTENSITY.ULTRA) {
        // En ULTRA, on ne supprime que si ce n'est pas protégé, pas stop-word et longueur > 2
        const isProtected = PROTECTED_SHORT_TOKENS.has(lower);
        const isTechnicalPattern = /^[A-Z0-9.#+_-]+$/.test(word); // Sigles Majuscules ou techniques
        
        if (isStopWord) return false;
        if (lower.length <= 2 && !isProtected && !isTechnicalPattern) return false;
        return true;
      }

      return !isStopWord;
    });
    processed = filtered.join(' ');
  }

  // 4. Restore Technicals
  const restoreRegex = new RegExp(`${sentinelPrefix}(\\d+)__`, 'g');
  processed = processed.replace(restoreRegex, (_, index) => technicals[parseInt(index)]);

  // 5. Final Cleanup
  processed = processed
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();

  return processed;
}

/**
 * Compresses an object's specific fields
 */
export function shrinkObject(obj, fields = ['description', 'prompt', 'when_to_use'], level = INTENSITY.FULL) {
  const newObj = { ...obj };
  for (const field of fields) {
    if (newObj[field]) {
      if (Array.isArray(newObj[field])) {
        newObj[field] = newObj[field].map(item => typeof item === 'string' ? shrink(item, level) : item);
      } else if (typeof newObj[field] === 'string') {
        newObj[field] = shrink(newObj[field], level);
      }
    }
  }
  return newObj;
}

export default {
  shrink,
  shrinkObject,
  INTENSITY
};
