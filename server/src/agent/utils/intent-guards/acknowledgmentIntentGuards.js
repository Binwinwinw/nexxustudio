/**
 * Heuristique déterministe pour détecter les requêtes d'acquittement strictes.
 * Permet de bloquer la sur-livraison en exigeant une réponse d'accusé minimale ("Oui, j'ai bien compris").
 */

export function isAcknowledgmentRequest(query) {
  if (!query || typeof query !== "string") return false;
  
  const q = query.toLowerCase();

  // Positifs forts ("dis-moi oui si tu as compris", "confirme que tu as compris")
  if (/\b(?:dis[- ]?moi|réponds) (?:oui|non) si tu (?:as|as bien) compris\b/.test(q)) return true;
  if (/\bconfirme[- ]?moi si tu (?:as|as bien) compris\b/.test(q)) return true;
  if (/\bconfirme que tu (?:as|as bien) compris\b/.test(q)) return true;
  if (/\b(?:as[- ]tu|tu as) bien compris\b/.test(q)) return true;
  if (/\bdis[- ]?moi si c'est clair\b/.test(q)) return true;
  if (/\bconfirme[- ]?moi que c'est clair\b/.test(q)) return true;

  // Négatifs : "tu as compris ce bug ?" ne doit pas déclencher
  // On ne veut pas capturer un simple "tu as compris ?" noyé dans une phrase technique.
  // Une formulation du type "tu as compris ?" en fin de phrase peut être un check, 
  // mais sans le "bien", c'est risqué. On préfère cibler l'intention explicite d'accusé.
  
  return false;
}
