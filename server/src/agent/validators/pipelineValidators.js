import { getValidator } from './compileSchemas.js';

function validateWithAjv(schemaId, data, objectName) {
  const validate = getValidator(schemaId);
  const isValid = validate(data);
  if (!isValid) {
    const errorMsg = ajvErrorsToString(validate.errors);
    console.error(`[Schema Validation Error] Invalid data for ${objectName}:`, JSON.stringify(data, null, 2));
    throw new Error(`[Schema Validation Error] ${objectName} invalid: ${errorMsg}. Actual user_intent: ${data.user_intent}`);
  }
  return data;
}

function ajvErrorsToString(errors) {
  if (!errors) return 'Unknown error';
  return errors.map(err => {
    let msg = `${err.instancePath} ${err.message}`;
    if (err.params && err.params.allowedValues) {
      msg += ` (allowed: ${err.params.allowedValues.join(', ')})`;
    }
    return msg;
  }).join('; ');
}

export function validateQueryEnvelope(envelope) {
  return validateWithAjv('queryEnvelope.schema.json', envelope, 'QueryEnvelope');
}

export function validateEvidenceRecord(evidence) {
  return validateWithAjv('evidenceRecord.schema.json', evidence, 'EvidenceRecord');
}

export function validateFactRecord(fact) {
  return validateWithAjv('factRecord.schema.json', fact, 'FactRecord');
}

export function validateAnswerDraft(draft) {
  return validateWithAjv('answerDraft.schema.json', draft, 'AnswerDraft');
}

export function validateFinalAnswer(answer) {
  return validateWithAjv('finalAnswer.schema.json', answer, 'FinalAnswer');
}

export function validateQuickAnswer(answer) {
  return validateWithAjv('quickAnswer.schema.json', answer, 'QuickAnswer');
}

export function validateRenderedAnswer(answer) {
  return validateWithAjv('renderedAnswer.schema.json', answer, 'RenderedAnswer');
}

export function validateOrchestratorPacket(packet) {
  return validateWithAjv('orchestratorPacket.schema.json', packet, 'OrchestratorPacket');
}
