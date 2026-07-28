import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { MemoryRetentionPolicy, MEMORY_STATUS } from './memoryRetentionPolicy.js';
import { MemoryConflictResolver } from './memoryConflictResolver.js';

const MEMORY_FILE_PATH = path.resolve('server', 'data', 'citadel_memory.jsonl');

/**
 * Memory Store Service
 * Gère la persistance en JSONL et applique les hard fails en cas de violation de contrat.
 */
export class MemoryStoreService {

  /**
   * Initialise le fichier de mémoire s'il n'existe pas.
   */
  static async init() {
    try {
      await fs.access(MEMORY_FILE_PATH);
    } catch {
      await fs.mkdir(path.dirname(MEMORY_FILE_PATH), { recursive: true });
      await fs.writeFile(MEMORY_FILE_PATH, '', 'utf-8');
    }
  }

  /**
   * Récupère toutes les mémoires, filtre les obsolètes et purge celles qui doivent l'être.
   */
  static async getActiveMemories() {
    await this.init();
    const content = await fs.readFile(MEMORY_FILE_PATH, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    
    let memories = lines.map(line => JSON.parse(line));
    let needsRewrite = false;

    const processedMemories = [];

    for (let mem of memories) {
      const newStatus = MemoryRetentionPolicy.evaluateLifeCycle(mem);
      
      if (newStatus === 'purge') {
        needsRewrite = true;
        continue;
      }

      if (newStatus !== mem.status) {
        mem.status = newStatus;
        needsRewrite = true;
      }
      
      processedMemories.push(mem);
    }

    if (needsRewrite) {
      await this._rewriteFile(processedMemories);
    }

    return processedMemories.filter(m => m.status === MEMORY_STATUS.ACTIVE);
  }

  /**
   * Écrit une mémoire validée dans le store.
   * Cette méthode est le Hard Gate: si verdict !== pass, on crashe.
   * @param {Object} packet
   */
  static async commitMemory(packet) {
    if (packet.meta?.final_contract_verdict !== "pass") {
       throw new Error(`[Hard Fail] Contrat mémoire violé ou non validé. Raisons: ${packet.meta?.final_failed_rules?.join(', ')}`);
    }

    const payload = packet.payload;
    if (payload.operation === 'SKIP') return { status: 'skipped' };

    const activeMemories = await this.getActiveMemories();
    const conflictCheck = MemoryConflictResolver.checkConflicts(payload, activeMemories);

    if (conflictCheck.hasConflict) {
       throw new Error(`[Hard Fail] Conflit mémoire détecté: ${conflictCheck.reasons.join(' | ')}`);
    }

    // Invalidation des anciennes mémoires si supersedes
    let needsRewrite = false;
    if (conflictCheck.supersedes.length > 0) {
      const allMemories = await this._getAllMemories();
      for (const oldMem of allMemories) {
         if (conflictCheck.supersedes.some(s => s.id === oldMem.id)) {
            oldMem.status = MEMORY_STATUS.INVALIDATED;
            needsRewrite = true;
         }
      }
      if (needsRewrite) await this._rewriteFile(allMemories);
    }

    if (payload.operation === 'ADD' || payload.operation === 'UPDATE') {
      const newMemory = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        status: MEMORY_STATUS.ACTIVE,
        contract_name: payload.contract_name,
        memory_type: payload.memory_type,
        scope: payload.scope,
        subject: payload.subject,
        proposed_memory: payload.proposed_memory,
        evidence: payload.evidence,
        retention: payload.retention || MemoryRetentionPolicy.getDefaultPolicy(payload.memory_type),
        candidate_keys: payload.conflict_check?.candidate_keys || [],
        confidence: payload.confidence,
        write_reason: payload.write_reason
      };

      await fs.appendFile(MEMORY_FILE_PATH, JSON.stringify(newMemory) + '\n', 'utf-8');
      return { status: 'committed', id: newMemory.id, record: newMemory };
    }
    
    return { status: 'processed_deletion' };
  }

  static async _getAllMemories() {
    await this.init();
    const content = await fs.readFile(MEMORY_FILE_PATH, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.map(line => JSON.parse(line));
  }

  static async _rewriteFile(memories) {
    const data = memories.map(m => JSON.stringify(m)).join('\n') + '\n';
    await fs.writeFile(MEMORY_FILE_PATH, data, 'utf-8');
  }
}
