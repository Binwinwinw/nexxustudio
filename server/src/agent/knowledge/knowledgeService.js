import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import manifest from './manifest.json' with { type: 'json' };
import { resolveGovernedTopic } from './knowledgeRouter.js';
import turnTelemetry from '../telemetry/turnTelemetry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class KnowledgeService {
  constructor() {
    this.cache = new Map();
    this.runtimeStats = {
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  getManifestEntry(id) {
    return manifest.find((entry) => entry.id === id) || null;
  }

  getDocPath(id) {
    const entry = this.getManifestEntry(id);
    return path.join(__dirname, entry?.fileName || `${id.replace(/-/g, '_')}.md`);
  }

  async loadDocument(id) {
    if (this.cache.has(id)) {
      this.runtimeStats.cacheHits += 1;
      turnTelemetry.increment('governedCacheHits');
      console.log(`[Knowledge][L3_DOCUMENT] cache hit id=${id} hits=${this.runtimeStats.cacheHits}`);
      return this.cache.get(id);
    }

    this.runtimeStats.cacheMisses += 1;
    turnTelemetry.markLayer('L3_DOCUMENT');
    turnTelemetry.increment('governedDocLoads');
    console.log(`[Knowledge][L3_DOCUMENT] lazy load id=${id} misses=${this.runtimeStats.cacheMisses}`);
    const filePath = this.getDocPath(id);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = this.parseDocument(raw);
    this.cache.set(id, parsed);
    return parsed;
  }

  parseDocument(raw = '') {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, content: raw.trim() };
    }

    const [, frontmatterBlock, content] = match;
    const frontmatter = {};

    for (const line of frontmatterBlock.split('\n')) {
      const [key, ...rest] = line.split(':');
      if (!key || rest.length === 0) continue;
      frontmatter[key.trim()] = rest.join(':').trim();
    }

    return { frontmatter, content: content.trim() };
  }

  async resolveGovernedContext(query = '') {
    const topic = resolveGovernedTopic(query);
    if (!topic) {
      return { type: 'none' };
    }

    let document;
    try {
      document = await this.loadDocument(topic.id);
    } catch (error) {
      return {
        type: 'governed_missing',
        topic,
        error: error.message
      };
    }

    const manifestEntry = this.getManifestEntry(topic.id);
    const passage = this.extractPassage(document.content);

    if (!document.content || !passage) {
      return {
        type: 'governed_missing',
        topic: manifestEntry,
        error: 'empty_document'
      };
    }

    return {
      type: manifestEntry?.mode || 'none',
      topic: manifestEntry,
      passage,
      document: document.content
    };
  }

  extractPassage(content = '') {
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('---'))
      .slice(0, 8)
      .join('\n');
  }

  buildDirectAnswer(context) {
    const { topic, document } = context;
    if (!topic || !document) {
      return '';
    }

    const lines = document
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith('#') && !line.startsWith('---'));

    const firstParagraph = lines
      .find((line) => !line.endsWith(':') && !line.startsWith('-') && !/^\d+\./.test(line));

    if (!firstParagraph) {
      return context.passage || '';
    }

    return firstParagraph;
  }

  buildGroundedBriefing(context) {
    const { topic, passage, document } = context;
    if (!topic) {
      return '';
    }

    return [
      `[SOURCE GOUVERNÉE] ${topic.title}`,
      `AUTORITÉ: ${topic.authority}`,
      `MODE AUTORISÉ: ${topic.mode}`,
      'RÈGLE: Répondre uniquement à partir du contexte ci-dessous. Si une information manque, dire qu elle n est pas définie actuellement.',
      'CONTEXTE COURT:',
      passage,
      'DOCUMENT DE RÉFÉRENCE:',
      document
    ].join('\n');
  }

  buildStrictFallback(context) {
    const topicTitle = context?.topic?.title || 'cette information';
    return `Cette demande relève de "${topicTitle}", mais aucune source gouvernée exploitable n'est disponible actuellement. Je préfère ne pas inventer de réponse.`;
  }
}

export default new KnowledgeService();
