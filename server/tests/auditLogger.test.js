import fs from 'fs';
import path from 'path';
import os from 'os';
import assert from 'assert';
import { AuditLogger } from '../src/security/auditLogger.js';

const TEST_LOG_DIR = path.join(os.tmpdir(), `nexxus-audit-test-${Date.now()}`);

async function runTests() {
    console.log("Démarrage des tests AuditLogger...");
    
    if (fs.existsSync(TEST_LOG_DIR)) {
        fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
    }

    try {
        const logger = new AuditLogger(TEST_LOG_DIR);

        // Test 1: Canonicalization / Chain integrity
        console.log("-> Test 1: Integrity & Canonicalization");
        const payload1 = { a: 1, b: 2 };
        logger.logEvent('TEST_ACTION_1', payload1);

        const payload2 = { b: 2, a: 1 };
        logger.logEvent('TEST_ACTION_2', payload2);
        
        const isChainValid = logger.verifyChain();
        assert.strictEqual(isChainValid, true, "La chaîne devrait être valide.");

        // Test 2: Tamper evidence
        console.log("-> Test 2: Tamper Evidence");
        const auditFile = logger.auditFile;
        let content = fs.readFileSync(auditFile, 'utf8').trim();
        let lines = content.split('\n');
        
        let corruptedEvent = JSON.parse(lines[0]);
        corruptedEvent.payload.a = 999; 
        lines[0] = JSON.stringify(corruptedEvent);
        
        fs.writeFileSync(auditFile, lines.join('\n') + '\n');
        
        const isChainValidAfterTamper = logger.verifyChain();
        assert.strictEqual(isChainValidAfterTamper, false, "La chaîne devrait être INVALIDE après altération.");

        // Restauration pour test 3
        fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
        const logger2 = new AuditLogger(TEST_LOG_DIR);

        // Test 3: Fail-safe mode
        console.log("-> Test 3: Fail-safe Mode");
        logger2.logEvent('BEFORE_FAIL', { data: 'ok' });
        
        fs.chmodSync(logger2.auditFile, 0o400); // Read-only
        
        let threwError = false;
        try {
            logger2.logEvent('SHOULD_FAIL', { data: 'error' });
        } catch (error) {
            threwError = true;
            assert.ok(error.message.includes('Audit System Failure'), "L'erreur doit mentionner Audit System Failure.");
        }
        
        assert.strictEqual(threwError, true, "Le logger devrait lever une exception si l'écriture échoue.");
        
        console.log("✅ Tous les tests d'AuditLogger ont réussi !");
    } finally {
        if (fs.existsSync(TEST_LOG_DIR)) {
            try {
                fs.chmodSync(path.join(TEST_LOG_DIR, 'audit_events.jsonl'), 0o600);
            } catch (e) {}
            fs.rmSync(TEST_LOG_DIR, { recursive: true, force: true });
        }
    }
}

runTests().catch(err => {
    console.error("❌ Erreur lors des tests:", err);
    process.exit(1);
});
