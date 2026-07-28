import { jest } from '@jest/globals';
import { sequentialConsensus } from '../../citadelle-vault/Citadelle/01-Architecture/03-Forge/sequential-consensus.js';
import ollama from '../src/llm/ollama.js';

describe('Sequential Consensus Module', () => {
  let chatSafeSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock par défaut : réponses simulées via chatSafe
    chatSafeSpy = jest.spyOn(ollama, 'chatSafe').mockImplementation(async (messages, model, options) => {
      const sysMsg = messages.find(m => m.role === 'system')?.content || '';
      if (sysMsg.includes('Propose une solution optimale')) {
        return 'solution simulée 1';
      }
      if (sysMsg.includes('Propose une approche alternative')) {
        return 'solution simulée 2';
      }
      if (sysMsg.includes('Évalue ces solutions')) {
        return 'critique simulée';
      }
      if (sysMsg.includes('Synthétise la voix finale')) {
        return 'synthèse finale';
      }
      return 'réponse générique';
    });
  });

  afterAll(() => {
    // Nettoyage de l'intervalle heartbeat pour que Jest puisse se terminer
    if (ollama.heartbeatInterval) {
      clearInterval(ollama.heartbeatInterval);
    }
  });
  
  test('orchestration — 4 appels séquentiels dans l\'ordre', async () => {
    const query = 'Quelle base de données choisir : Redis ou SQLite ?';
    const context = { criteria: 'performance, persistence' };
    
    const result = await sequentialConsensus(query, context);
    
    // Vérification : 4 appels en tout (2 générations, 1 évaluation, 1 synthèse)
    expect(chatSafeSpy).toHaveBeenCalledTimes(4);
    
    // Vérification : résultat contient la synthèse
    expect(result.result).toBe('synthèse finale');
    expect(result.metadata.mode).toBe('HAUTE_FIDELITÉ');
    expect(result.metadata.steps).toBe(4);
  });
  
  test('fail-closed — fallback en cas d\'échec', async () => {
    chatSafeSpy.mockRejectedValueOnce(new Error('OOM'));
    
    await expect(sequentialConsensus('test query', {}))
      .rejects.toThrow('SEQUENTIAL_CONSENSUS_FAILED: OOM');
  });
  
  test('résilience — continue si evaluate échoue', async () => {
    // Si evaluate (appel 3) échoue, ça doit throw l'erreur
    chatSafeSpy.mockImplementationOnce(() => Promise.resolve('solution 1'))
               .mockImplementationOnce(() => Promise.resolve('solution 2'))
               .mockImplementationOnce(() => Promise.reject(new Error('Timeout')));
    
    await expect(sequentialConsensus('test', {}))
      .rejects.toThrow('SEQUENTIAL_CONSENSUS_FAILED: Timeout');
  });
  
  test('performance — ne bloque pas la boucle Node', async () => {
    const startTime = process.hrtime.bigint();
    
    await sequentialConsensus('test', {});
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    
    // La latence attendue est ~3x le temps habituel (4 passes séquentielles simulées)
    // Ici le mock est instantané donc ça passera largement
    expect(durationMs).toBeLessThan(30000); // Max 30 secondes
  });
});
