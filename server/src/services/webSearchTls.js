/**
 * Agent HTTPS pour WebSearchService — contourne les erreurs de chaîne CA en dev local.
 * Production : strict par défaut. Dev : assoupli sauf WEB_SEARCH_STRICT_SSL=true.
 */
import https from "node:https";

let cachedAgent = null;
let cacheStrict = null;

/**
 * @returns {https.Agent|undefined}
 */
export function createWebSearchHttpsAgent() {
  const strict =
    process.env.WEB_SEARCH_STRICT_SSL === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.WEB_SEARCH_ALLOW_INSECURE_SSL !== "true");

  if (strict) return undefined;

  if (cachedAgent && cacheStrict === false) return cachedAgent;

  console.warn(
    "[WebSearchService] TLS dev : vérification certificat assouplie pour DuckDuckGo (WEB_SEARCH_STRICT_SSL=true pour forcer le mode strict).",
  );
  cachedAgent = new https.Agent({ rejectUnauthorized: false });
  cacheStrict = false;
  return cachedAgent;
}

/**
 * @returns {boolean}
 */
export function isWebSearchTlsStrict() {
  return (
    process.env.WEB_SEARCH_STRICT_SSL === "true" ||
    (process.env.NODE_ENV === "production" &&
      process.env.WEB_SEARCH_ALLOW_INSECURE_SSL !== "true")
  );
}
