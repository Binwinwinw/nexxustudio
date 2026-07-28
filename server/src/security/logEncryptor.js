/* server/src/security/logEncryptor.js */
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 octets est la norme recommandée pour GCM
const TAG_LENGTH = 16; // 16 octets pour le tag d'authentification

/**
 * Récupère et résout la clé d'encryption sous forme de Buffer
 */
function getEncryptionKey() {
  const keyRaw = process.env.LOG_ENCRYPTION_KEY;
  if (!keyRaw) {
    throw new Error("LOG_ENCRYPTION_KEY manquante dans l'environnement.");
  }

  let keyBuffer;
  if (/^[0-9a-fA-F]{64}$/.test(keyRaw)) {
    keyBuffer = Buffer.from(keyRaw, 'hex');
  } else if (/^[A-Za-z0-9+/=]+$/.test(keyRaw)) {
    keyBuffer = Buffer.from(keyRaw, 'base64');
  }

  if (!keyBuffer || keyBuffer.length !== 32) {
    throw new Error("Clé de chiffrement invalide. Doit être de 32 octets.");
  }

  return keyBuffer;
}

/**
 * Chiffre un texte brut ou un objet JSON avec AES-256-GCM.
 * Retourne une chaîne formatée : iv_hex:authTag_hex:ciphertext_hex
 * @param {string|Object} data 
 * @returns {string}
 */
export function encrypt(data) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const plaintext = typeof data === "object" ? JSON.stringify(data) : String(data);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${ciphertext}`;
  } catch (err) {
    console.error("[logEncryptor] Erreur d'encryption :", err.message);
    throw err;
  }
}

/**
 * Déchiffre un message chiffré en AES-256-GCM.
 * Si le format n'est pas chiffré et que la lecture legacy en clair est autorisée,
 * retourne directement le texte en clair.
 * @param {string} encryptedString 
 * @returns {string}
 */
export function decrypt(encryptedString) {
  const cleanStr = String(encryptedString || "").trim();
  
  if (!cleanStr) return "";

  // 🔄 GESTION TRANSOITORE LEGACY (PLAINTEXT FALLBACK)
  const isPlaintextJson = cleanStr.startsWith("{") || cleanStr.startsWith("[");
  if (isPlaintextJson) {
    const allowLegacy = process.env.ALLOW_LEGACY_PLAINTEXT_LOGS === "true";
    if (allowLegacy) {
      console.warn("⚠️ [logEncryptor] Lecture d'une trace en clair autorisée par configuration transitoire.");
      return cleanStr;
    } else {
      throw new Error("Interdiction de lire des logs en clair (ALLOW_LEGACY_PLAINTEXT_LOGS désactivé).");
    }
  }

  try {
    const key = getEncryptionKey();
    const parts = cleanStr.split(":");
    if (parts.length !== 3) {
      throw new Error("Format de paquet chiffré AES-GCM invalide.");
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, "binary", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
  } catch (err) {
    console.error("[logEncryptor] Échec du déchiffrement AES-GCM :", err.message);
    throw err;
  }
}
