import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import stringify from 'fast-json-stable-stringify';
import os from 'os';

const LOG_DIR = path.join(process.cwd(), 'logs');
const AUDIT_FILE = path.join(LOG_DIR, 'audit_events.jsonl');
const SCHEMA_VERSION = '1.0';
const WRITER_ID = `nexxus-server-${os.hostname()}`;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

class AuditLogger {
    constructor(customLogDir = null) {
        this.logDir = customLogDir || path.join(process.cwd(), 'logs');
        this.auditFile = path.join(this.logDir, 'audit_events.jsonl');
        
        this.currentPosition = 0;
        this.lastHash = null;
        this.initialized = false;
        // The init() method should be called explicitly or at first event to avoid early errors in some contexts
        // but for a singleton, we try to init synchronously.
        this.init();
    }

    init() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
            }

            if (!fs.existsSync(this.auditFile)) {
                // Création du fichier avec permissions strictes
                fs.writeFileSync(this.auditFile, '', { mode: 0o600 });
                this.currentPosition = 0;
                this.lastHash = crypto.createHash('sha256').update('GENESIS').digest('hex');
            } else {
                // Lire la dernière ligne pour récupérer lastHash et chain_position
                const content = fs.readFileSync(this.auditFile, 'utf8').trim();
                if (content.length > 0) {
                    const lines = content.split('\n');
                    const lastLine = lines[lines.length - 1];
                    try {
                        const lastEvent = JSON.parse(lastLine);
                        this.currentPosition = lastEvent.chain_position || 0;
                        this.lastHash = lastEvent.entry_hash || crypto.createHash('sha256').update('GENESIS').digest('hex');
                    } catch (e) {
                        // En cas de corruption de la dernière ligne, on sécurise
                        this.currentPosition = lines.length;
                        this.lastHash = crypto.createHash('sha256').update('CORRUPT_STATE').digest('hex');
                    }
                } else {
                    this.currentPosition = 0;
                    this.lastHash = crypto.createHash('sha256').update('GENESIS').digest('hex');
                }
            }
            this.initialized = true;
        } catch (error) {
            console.error("Erreur critique lors de l'initialisation du journal d'audit:", error);
            throw new Error(`Audit System Failure (Fail-Safe): Impossible d'initialiser le log d'audit. ${error.message}`);
        }
    }

    rotateLogIfNeeded() {
        try {
            const stats = fs.statSync(this.auditFile);
            if (stats.size >= MAX_FILE_SIZE) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const rotatedFile = path.join(this.logDir, `audit_events_${timestamp}.jsonl`);
                fs.renameSync(this.auditFile, rotatedFile);
                fs.chmodSync(rotatedFile, 0o400); // Read-only archive
                
                // Recréer le nouveau fichier
                fs.writeFileSync(this.auditFile, '', { mode: 0o600 });
                
                // Log de rotation dans le NOUVEAU fichier
                this.logAccess('ROTATION', `Fichier d'audit rotaté vers ${rotatedFile}`);
            }
        } catch (error) {
            throw new Error(`Audit System Failure (Fail-Safe): Rotation impossible. ${error.message}`);
        }
    }

    logEvent(action, payload) {
        if (!this.initialized) {
            throw new Error("Audit System Failure (Fail-Safe): Logger non initialisé.");
        }

        try {
            this.rotateLogIfNeeded();

            this.currentPosition += 1;
            
            // Construire l'événement de base (sans le hash courant)
            const event = {
                schema_version: SCHEMA_VERSION,
                writer_id: WRITER_ID,
                timestamp: new Date().toISOString(),
                action,
                payload,
                chain_position: this.currentPosition,
                previous_hash: this.lastHash
            };

            // Canonicalisation selon RFC 8785
            const canonicalEvent = stringify(event);

            // Calcul du hash
            const entryHash = crypto.createHash('sha256').update(canonicalEvent).digest('hex');
            
            // Ajout du hash à l'événement final
            event.entry_hash = entryHash;
            
            const finalLine = JSON.stringify(event) + '\n';

            // Append with strict mode. If this fails, catch block catches it.
            fs.appendFileSync(this.auditFile, finalLine, { mode: 0o600 });
            
            // Mettre à jour l'état mémoire seulement si l'écriture a réussi
            this.lastHash = entryHash;

            return event;

        } catch (error) {
            // Fail-safe mode
            throw new Error(`Audit System Failure (Fail-Safe): Échec d'écriture de l'événement d'audit. ${error.message}`);
        }
    }

    logAccess(operation, details) {
        // Journalise spécifiquement les accès au dépôt d'audit (READ, EXPORT, DELETE, ROTATE)
        return this.logEvent('AUDIT_ACCESS', {
            operation,
            details
        });
    }

    verifyChain() {
        // Fonction utilitaire pour vérifier l'intégrité de la chaîne
        if (!fs.existsSync(this.auditFile)) return true;

        const content = fs.readFileSync(this.auditFile, 'utf8').trim();
        if (content.length === 0) return true;

        const lines = content.split('\n');
        let prevHash = crypto.createHash('sha256').update('GENESIS').digest('hex');

        for (let i = 0; i < lines.length; i++) {
            const event = JSON.parse(lines[i]);
            
            if (event.previous_hash !== prevHash) {
                return false; // Chaîne brisée
            }

            const eventWithoutEntryHash = { ...event };
            delete eventWithoutEntryHash.entry_hash;

            const canonicalEvent = stringify(eventWithoutEntryHash);
            const calculatedHash = crypto.createHash('sha256').update(canonicalEvent).digest('hex');

            if (calculatedHash !== event.entry_hash) {
                return false; // Altération détectée
            }

            prevHash = calculatedHash;
        }

        return true;
    }
}

// Export d'une instance unique (singleton)
export const auditLogger = new AuditLogger();
// Pour les tests
export { AuditLogger };
