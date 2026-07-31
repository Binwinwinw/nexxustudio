import { getClientForModel } from '../../../llm/llmFactory.js';
import { AGENT_ROLES } from '../../policies/core/index.js';
import { MEMORY_WRITE_CONTRACT_V1 } from './memoryWriteContract.js';

const GUARDIAN_SYSTEM_PROMPT = `[ROLE]
Tu es le Gardien de la Mémoire (Memory Guardian) de La Citadelle.
Ton objectif est de décider si l'interaction actuelle contient de la connaissance, des décisions ou des faits durables qui méritent d'être conservés à long terme.

[ACTION OBLIGATOIRE]
Tu dois renvoyer un objet JSON strictement conforme au contrat MEMORY_WRITE_GUARDIAN_V1.
Si aucune information durable n'est présente, renvoie une opération "SKIP".
Ne réponds jamais par du texte libre. Uniquement le JSON validé.

[STRUCTURE DU JSON]
${JSON.stringify(MEMORY_WRITE_CONTRACT_V1, null, 2)}`;

export class MemoryGuardianAgent {

  /**
   * Analyse le contexte et propose une écriture de mémoire (ADD, UPDATE, DELETE, SKIP)
   * @param {string} userQuery 
   * @param {string} assistantResponse 
   * @param {Array} currentMemories 
   */
  static async proposeMemoryWrite(userQuery, assistantResponse, currentMemories = []) {
    const client = getClientForModel(AGENT_ROLES.PLANNER);
    
    const userPrompt = `
[CONTEXTE MÉMOIRE EXISTANTE]
${currentMemories.length > 0 ? JSON.stringify(currentMemories) : "Aucune mémoire pertinente active."}

[INTERACTION ACTUELLE]
User: ${userQuery}
Assistant: ${assistantResponse}

[INSTRUCTION]
Génère le JSON strict MEMORY_WRITE_GUARDIAN_V1 pour cette interaction.`;

    try {
      const response = await client.chat([
        { role: "system", content: GUARDIAN_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ], AGENT_ROLES.PLANNER, { temperature: 0.1 });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return JSON.parse(response);
    } catch (err) {
      console.warn("[MemoryGuardianAgent] Échec de la génération JSON :", err.message);
      return {
        contract_name: 'MEMORY_WRITE_GUARDIAN_V1',
        operation: 'SKIP',
        write_reason: "Erreur de génération du JSON"
      };
    }
  }
}
