/**
 * Memory Write Guardian Contract (V1)
 * Définit la structure stricte pour l'injection ou modification de la mémoire.
 */

export const MEMORY_OPERATIONS = ['ADD', 'UPDATE', 'DELETE', 'SKIP'];
export const MEMORY_TYPES = ['working', 'episodic', 'semantic', 'heritage'];
export const MEMORY_SCOPES = ['project', 'user', 'system'];

export const MEMORY_WRITE_CONTRACT_V1 = {
  contract_name: 'MEMORY_WRITE_GUARDIAN_V1',
  description: 'Contrat strict pour la modification de la mémoire à long terme.',
  schema: {
    type: 'object',
    required: [
      'contract_name', 'operation', 'memory_type', 'scope', 'subject', 
      'proposed_memory', 'evidence', 'retention', 'conflict_check', 
      'confidence', 'write_reason', 'unknowns', 'forbidden_speculation'
    ],
    properties: {
      contract_name: { type: 'string', const: 'MEMORY_WRITE_GUARDIAN_V1' },
      operation: { type: 'string', enum: MEMORY_OPERATIONS },
      memory_type: { type: 'string', enum: MEMORY_TYPES },
      scope: { type: 'string', enum: MEMORY_SCOPES },
      subject: { type: 'string' },
      proposed_memory: {
        type: 'object',
        required: ['title', 'content', 'normalized_facts'],
        properties: {
          title: { type: 'string' },
          content: { type: 'string' },
          normalized_facts: { type: 'array', items: { type: 'string' } }
        }
      },
      evidence: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'source_type', 'quote', 'turn_ref', 'lineage'],
          properties: {
            id: { type: 'string', pattern: '^E\\d+$' },
            source_type: { type: 'string', enum: ['conversation', 'file', 'observation'] },
            quote: { type: 'string' },
            turn_ref: { type: 'string' },
            lineage: { type: 'string' }
          }
        }
      },
      retention: {
        type: 'object',
        required: ['policy', 'review_at', 'ttl_days'],
        properties: {
          policy: { type: 'string', enum: ['review_at', 'auto_purge', 'permanent'] },
          review_at: { type: 'string' },
          ttl_days: { type: 'number' }
        }
      },
      conflict_check: {
        type: 'object',
        required: ['candidate_keys', 'supersedes_memory_ids', 'possible_conflicts'],
        properties: {
          candidate_keys: { type: 'array', items: { type: 'string' } },
          supersedes_memory_ids: { type: 'array', items: { type: 'string' } },
          possible_conflicts: { type: 'array', items: { type: 'string' } }
        }
      },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      write_reason: { type: 'string' },
      unknowns: { type: 'array', items: { type: 'string' } },
      forbidden_speculation: { type: 'array', items: { type: 'string' } }
    }
  }
};
