import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import skillLoader from '../src/agent/utils/skillLoader.js';

describe('skillLoader', () => {
  it('priorise intentIds sur les triggers fallback larges', async () => {
    skillLoader.invalidateCache();
    const id = await skillLoader.identifyRelevantSkill('Bonjour Nexxus, analyse ce code', {
      intentContractId: 'DOCUMENT_ATTACHED',
    });
    assert.equal(id, 'skill-document-analysis');
  });

  it('choisit le trigger le plus spécifique sans intent', async () => {
    skillLoader.invalidateCache();
    const id = await skillLoader.identifyRelevantSkill(
      'Le upload refusé indique une double extension sur le fichier',
    );
    assert.equal(id, 'skill-upload-security');
  });

  it('utilise skill-007-orchestrator seulement en fallback', async () => {
    skillLoader.invalidateCache();
    const id = await skillLoader.identifyRelevantSkill('Nexxus coding session pair-programming');
    assert.equal(id, 'skill-007-orchestrator');
  });

  it('PDF preview fallback vers document-analysis', async () => {
    skillLoader.invalidateCache();
    const id = await skillLoader.identifyRelevantSkill('Prévisualiser le pdf joint', {
      intentContractId: 'DOCUMENT_ATTACHED',
    });
    assert.equal(id, 'skill-document-analysis');
  });

  it('respecte SKILLS_DISABLED feature flag', async () => {
    const prev = process.env.SKILLS_DISABLED;
    process.env.SKILLS_DISABLED = 'skill-pdf-extraction';
    skillLoader.invalidateCache();
    const id = await skillLoader.identifyRelevantSkill('Extraire le texte de ce pdf', {
      intentContractId: 'DOCUMENT_ATTACHED',
    });
    process.env.SKILLS_DISABLED = prev ?? '';
    skillLoader.invalidateCache();
    assert.equal(id, 'skill-document-analysis');
  });
});
