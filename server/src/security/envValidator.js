/* server/src/security/envValidator.js */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_ENV_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);
dotenv.config({ path: SERVER_ENV_PATH });

/**
 * Validateur d'Environnement Strict (SOTA v1.2)
 * Applique la doctrine fail-closed sur la configuration sensible de La Citadelle.
 */
function validateEnvironment() {
  console.log("🧬 [Citadelle-Security] Analyse de la surface d'environnement...");

  const REQUIRED_VARS = [
    "JWT_SECRET",
    "INTERNAL_API_TOKEN",
    "LOG_ENCRYPTION_KEY"
  ];

  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`🔥 ERROR: Variables d'environnement critiques manquantes : ${missing.join(", ")}`);
    process.exit(1);
  }

  // Validation mathématique rigoureuse de la clé de chiffrement (LOG_ENCRYPTION_KEY)
  const keyRaw = process.env.LOG_ENCRYPTION_KEY;
  let keyBuffer;

  try {
    // 1. Essai de décodage Hex (64 caractères pour 32 octets)
    if (/^[0-9a-fA-F]{64}$/.test(keyRaw)) {
      keyBuffer = Buffer.from(keyRaw, 'hex');
    } 
    // 2. Essai de décodage Base64 (environ 44 caractères pour 32 octets)
    else if (/^[A-Za-z0-9+/=]+$/.test(keyRaw)) {
      keyBuffer = Buffer.from(keyRaw, 'base64');
    }
  } catch (err) {
    console.error("🔥 ERROR: Échec lors du décodage de LOG_ENCRYPTION_KEY. La clé doit être en Hex ou Base64.");
    process.exit(1);
  }

  if (!keyBuffer || keyBuffer.length !== 32) {
    console.error(`🔥 ERROR: La clé LOG_ENCRYPTION_KEY doit représenter exactement 32 octets après décodage. Reçu : ${keyBuffer ? keyBuffer.length : 0} octets.`);
    process.exit(1);
  }

  // Masquage des variables sensibles dans les outputs de démarrage
  const mask = (str) => str ? str.substring(0, 4) + "*".repeat(Math.max(4, str.length - 8)) + str.substring(str.length - 4) : "undefined";

  console.log("✅ [Citadelle-Security] Clés de sécurité validées :");
  console.log(`   - JWT_SECRET          : ${mask(process.env.JWT_SECRET)}`);
  console.log(`   - INTERNAL_API_TOKEN  : ${mask(process.env.INTERNAL_API_TOKEN)}`);
  console.log(`   - LOG_ENCRYPTION_KEY  : [AES-256-GCM ACTIVE - 32 octets validés]`);
}

validateEnvironment();
