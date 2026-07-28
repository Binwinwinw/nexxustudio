import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ajv from './ajvInstance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractsDir = path.resolve(__dirname, '../contracts');

export function loadAndCompileSchemas() {
  const schemaFiles = fs.readdirSync(contractsDir).filter(file => file.endsWith('.schema.json'));
  
  for (const file of schemaFiles) {
    const filePath = path.join(contractsDir, file);
    const schemaContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    ajv.addSchema(schemaContent, schemaContent.$id);
  }
}

// Automatically compile schemas when this module is loaded
loadAndCompileSchemas();

export function getValidator(schemaId) {
  const validator = ajv.getSchema(schemaId);
  if (!validator) {
    throw new Error(`Schema ${schemaId} not found or compiled.`);
  }
  return validator;
}
