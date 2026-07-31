import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import ollama from '../../llm/ollama.js';
import thermalTelemetry from '../../agent/telemetry/thermalTelemetry.js';
import {
  normalizeKey,
  tokenizeTechText,
  safeJsonParse,
  cosineSimilarity,
  uniqueByFullKey,
  clampTop,
} from './routerUtils.js';
import { isPureSocial } from '../utils/conversationGuards.js';
import {
  ROUTER_LIMITS,
  ROUTER_MESSAGES,
  buildRouterDecisionPrompt,
} from './routerContracts.js';
import { AGENT_ROLES } from '../policies/core/index.js';
import { ROUTER_BUDGETS, ROUTER_LAYERS, formatLayerLog } from './routerLayers.js';
import turnTelemetry from '../telemetry/turnTelemetry.js';
import { OTEL_ATTRIBUTES, SPAN_NAMES } from '../telemetry/otelSemanticMap.js';
import knowledgeHub from '../../services/knowledgeHub.js';
import routingExplainer from './routingExplainer.js';
import caveman from '../../utils/cavemanShrink.js';

import * as manifestStore from './expertManifestStore.js';
import * as governor from './expertGovernor.js';
import { rrf } from './expertScorer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveServerPath(...segments) {
  return path.resolve(__dirname, '../../..', ...segments);
}

class ExpertRouter {
  constructor() {
    this.experts = new Map();    // fullKey → expert
    this.index = {};             // fullKey → { vector, expert }
    this.bm25Index = {};         // fullKey → { tf, len, expert }
    this.avgDl = 0;
    this.N = 0;
    this.idf = {};

    this.threshold = ROUTER_LIMITS.semanticThreshold;
    this.k1 = ROUTER_LIMITS.bm25.k1;
    this.b = ROUTER_LIMITS.bm25.b;

    this.expertsDir = resolveServerPath('data', 'experts');
    // Cache régénérable (BM25/embeddings) — pas une source de vérité
    this.cachePath = resolveServerPath('cache', 'experts_cache.json');
    this.runtimeCounters = {
      hydratedExperts: 0
    };
  }

  async ensurePaths() {
    const exists = await fs.pathExists(this.expertsDir);
    if (!exists) {
      throw new Error(`[Router] Experts directory not found: ${this.expertsDir}`);
    }
  }

  tokenize(text) {
    return tokenizeTechText(text);
  }

  buildTfIndex(expert) {
    const tf = {};

    const addTokens = (input, weight = 1) => {
      if (!input) return 0;
      const text = Array.isArray(input) ? input.join(' ') : String(input);
      const tokens = this.tokenize(text);
      for (const token of tokens) {
        tf[token] = (tf[token] || 0) + weight;
      }
      return tokens.length * weight;
    };

    let weightedLen = 0;
    weightedLen += addTokens(expert.name, 3);
    weightedLen += addTokens(expert.when_to_use, 2);
    weightedLen += addTokens(expert.description, 1);
    weightedLen += addTokens(expert.scope, 1);

    return { tf, weightedLen };
  }

  async init(onProgress = null) {
    await this.ensurePaths();

    const files = await fs.readdir(this.expertsDir);
    const jsonFiles = files
      .filter((f) => f.endsWith('.json'))
      .slice(0, ROUTER_BUDGETS.maxBootstrapFiles);

    let cache = {};
    if (await fs.pathExists(this.cachePath)) {
      try {
        cache = await fs.readJson(this.cachePath);
      } catch (e) {
        console.warn(ROUTER_MESSAGES.cacheCorrupted);
      }
    }

    this.experts.clear();
    this.index = {};
    this.bm25Index = {};
    this.idf = {};
    this.N = 0;
    this.avgDl = 0;

    let totalLength = 0;
    const df = {};

    console.time('bootstrap:manifest');
    console.log(formatLayerLog(ROUTER_LAYERS.L0_BOOTSTRAP, 'metadata bootstrap start', { files: jsonFiles.length }));
    for (const file of jsonFiles) {
      try {
        const fullPath = path.join(this.expertsDir, file);
        const content = await fs.readJson(fullPath);
        const expertList = manifestStore.extractManifestsFromFile(content, file, fullPath);

        for (const expert of expertList) {
          if (!expert) continue;

          if (this.experts.has(expert.fullKey)) {
            console.warn(`[Router] Duplicate expert fullKey ignored: ${expert.fullKey} (from ${file})`);
            continue;
          }

          this.experts.set(expert.fullKey, expert);

          const cached = cache[expert.fullKey];
          let storedData = null;

          if (Array.isArray(cached?.vector) && cached.vector.length > 0) {
            storedData = { vector: cached.vector, expert };
          } else {
            if (onProgress) {
              onProgress(`${ROUTER_MESSAGES.indexing} : [${expert.name}]...`);
            }
            try {
              const textToEmbed = `${expert.name} ${expert.description} ${expert.when_to_use.join(' ')}`.trim();
              const vector = await ollama.getEmbedding(textToEmbed);
              if (Array.isArray(vector) && vector.length > 0) {
                storedData = { vector, expert };
                cache[expert.fullKey] = { vector };
              }
            } catch (err) {
              console.error(`[Router] Error indexing ${expert.fullKey}:`, err.message);
            }
          }

          if (storedData?.vector?.length) {
            this.index[expert.fullKey] = storedData;
          }

          const { tf, weightedLen } = this.buildTfIndex(expert);
          this.bm25Index[expert.fullKey] = { tf, len: weightedLen, expert };
          totalLength += weightedLen;

          for (const token of Object.keys(tf)) {
            df[token] = (df[token] || 0) + 1;
          }
        }
      } catch (err) {
        console.error(`[Router] Error reading ${file}:`, err.message);
      }
    }
    console.timeEnd('bootstrap:manifest');

    console.time('bootstrap:router-index');

    this.N = this.experts.size;
    this.avgDl = this.N > 0 ? totalLength / this.N : 0;

    for (const token of Object.keys(df)) {
      this.idf[token] = Math.log((this.N - df[token] + 0.5) / (df[token] + 0.5) + 1);
    }

    try {
      await fs.ensureDir(path.dirname(this.cachePath));
      await fs.writeJson(this.cachePath, cache, { spaces: 2 });
    } catch (err) {
      console.error(`[Router] Error writing cache to ${this.cachePath}:`, err.message);
    }

    console.timeEnd('bootstrap:router-index');
    console.log(formatLayerLog(ROUTER_LAYERS.L0_BOOTSTRAP, 'metadata bootstrap ready', {
      manifests: this.experts.size,
      embeddings: Object.keys(this.index).length
    }));
  }

  getBM25Scores(query) {
    const queryTokens = this.tokenize(query);
    const scores = [];

    for (const key of Object.keys(this.bm25Index)) {
      const doc = this.bm25Index[key];
      let score = 0;

      for (const token of queryTokens) {
        if (this.idf[token] && doc.tf[token]) {
          const tf = doc.tf[token];
          const idf = this.idf[token];
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * ((doc.len || 1) / (this.avgDl || 1)));
          score += idf * (numerator / denominator);
        }
      }

      if (score > 0) {
        scores.push({ expert: doc.expert, score });
      }
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  async identify(query, onProgress = null) {
    if (this.experts.size === 0) {
      await this.init(onProgress);
    }

    if (onProgress) {
      onProgress(ROUTER_MESSAGES.scanning);
    }

    // --- NEXXUS SOCIAL GATE ---
    if (isPureSocial(query)) {
      return [];
    }

    // --- HYBRID IDENTIFICATION (V3.3.4) ---
    // 1. Lexical (BM25)
    turnTelemetry.startSpan(SPAN_NAMES.ROUTER_LEXICAL);
    const sortedBM25 = this.getBM25Scores(query);
    
    // 2. Semantic (Embeddings) - Reuse existing vectors if possible
    let queryVector = null;
    try {
      queryVector = await ollama.getEmbedding(query);
    } catch (err) {
      console.warn('[Router] Failed to generate query vector, fallback to BM25 only.');
    }

    const semanticScores = [];
    if (queryVector) {
      for (const [fullKey, doc] of Object.entries(this.index)) {
        const sim = cosineSimilarity(queryVector, doc.vector);
        if (sim > this.threshold) {
          semanticScores.push({ expert: doc.expert, score: sim });
        }
      }
      semanticScores.sort((a, b) => b.score - a.score);
    }

    // 3. Fusion (RRF)
    const fused = [];
    const allFullKeys = new Set([
      ...sortedBM25.map(m => m.expert.fullKey),
      ...semanticScores.map(m => m.expert.fullKey)
    ]);

    for (const fk of allFullKeys) {
      const rankLexical = sortedBM25.findIndex(m => m.expert.fullKey === fk);
      const rankSemantic = semanticScores.findIndex(m => m.expert.fullKey === fk);
      const expert = this.experts.get(fk);
      
      const fusionScore = rrf(rankLexical, rankSemantic);
      fused.push({ expert, score: fusionScore, lexicalRank: rankLexical, semanticRank: rankSemantic });
    }

    fused.sort((a, b) => b.score - a.score);

    const final = clampTop(
      fused,
      Math.min(ROUTER_LIMITS.maxLexicalCandidates || 8, ROUTER_BUDGETS.maxLexicalCandidates)
    );

    console.log(formatLayerLog(ROUTER_LAYERS.L1_LEXICAL_ROUTING, 'hybrid candidates selected', {
      lexical: sortedBM25.length,
      semantic: semanticScores.length,
      fused: final.length
    }));

    turnTelemetry.endSpan(SPAN_NAMES.ROUTER_LEXICAL, {
      [OTEL_ATTRIBUTES.ROUTER_CANDIDATES]: final.length,
      lexical: sortedBM25.length,
      semantic: semanticScores.length
    });
    
    turnTelemetry.markLayer(ROUTER_LAYERS.L1_LEXICAL_ROUTING);
    turnTelemetry.setMetric('lexicalCandidates', final.length);
    return final;
  }

  async cognitiveIdentify(query, candidates, onProgress = null) {
    if (!candidates || candidates.length === 0) {
      return { experts: [], plan: '' };
    }

    if (onProgress) {
      onProgress(ROUTER_MESSAGES.cognitive);
    }

    console.log(formatLayerLog(ROUTER_LAYERS.L2_COGNITIVE_SELECTION, 'cognitive narrowing start', {
      candidates: candidates.length
    }));
    turnTelemetry.startSpan(SPAN_NAMES.ROUTER_COGNITIVE);
    turnTelemetry.markLayer(ROUTER_LAYERS.L2_COGNITIVE_SELECTION);

    const master = await this.getExpertByKey('Elite:master_orchestrator');
    if (!master) {
      const out = clampTop(candidates, Math.min(ROUTER_LIMITS.maxCognitiveCandidates, ROUTER_BUDGETS.maxCognitiveCandidates));
      console.warn(`[Router] master_orchestrator not found, fallback selection [${out.map((m) => m.expert.fullKey).join(',')}]`);
      return { experts: out, plan: '' };
    }

    try {
      // 🔄 RÉCUPÉRATION DU FEEDBACK (R -> N)
      let feedbackContext = "";
      try {
        const feedback = await knowledgeHub.query(query, 3, { type: 'telemetry_feedback' });
        if (feedback && feedback.length > 0) {
          feedbackContext = "\n--- RETOUR D'EXPÉRIENCE (INCIDENTS PASSÉS) ---\n" + 
            feedback.map(f => f.content).join("\n");
        }
      } catch (e) {
        console.warn("[Router] Failed to fetch feedback context:", e.message);
      }

      const response = await ollama.chatSafe(
        [
          { role: 'system', content: master.prompt },
          { role: 'user', content: buildRouterDecisionPrompt(query, candidates) + feedbackContext },
        ],
        AGENT_ROLES.ORCHESTRATOR,
        { temperature: 0.1, num_predict: 250 }
      );

      const decision = safeJsonParse(response, { selected_experts: [], strategic_plan: '' });
      
      // --- THERMAL BIASING (V3.11) ---
      // Si le planificateur hésite ou pour affiner le choix, on regarde qui est "chaud"
      const selected = Array.isArray(decision.selected_experts)
        ? decision.selected_experts.map(normalizeKey)
        : [];
      const strategicPlan = decision.strategic_plan || '';

      const filtered = candidates.filter((c) => {
        const full = normalizeKey(c.expert.fullKey);
        const short = normalizeKey(c.expert.key);
        return selected.includes(full) || selected.includes(short);
      });

      // --- ADVANCED COGNITIVE SCORING (V3.3.4 Modular) ---
      const thermalStats = thermalTelemetry.getAllStats();
      const scoredCandidates = filtered.map(c => governor.evaluateCandidate(c, thermalStats));

      // Tri par score final
      scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);

      const cognitiveBudget = Math.min(ROUTER_LIMITS.maxCognitiveCandidates, ROUTER_BUDGETS.maxCognitiveCandidates);
      const picked = scoredCandidates.length > 0
        ? clampTop(scoredCandidates, cognitiveBudget)
        : clampTop(candidates, cognitiveBudget);

      if (strategicPlan && onProgress) {
        onProgress(`📝 Strategic Plan (Planner): ${strategicPlan}`);
      }

      turnTelemetry.endSpan(SPAN_NAMES.ROUTER_COGNITIVE, {
        [OTEL_ATTRIBUTES.ROUTER_SELECTED]: picked.length,
        confidence: decision.confidence || 0
      });
      // 🧠 GÉNÉRATION DE L'EXPLICATION (Routage Explicable)
      const explanation = routingExplainer.explain({
        selectedExpert: picked.map(o => o.expert.key).join(', '),
        rationale: decision.rationale || strategicPlan || 'Standard selection based on intent and expertise.',
        confidence: decision.confidence || 0.9
      }, { feedbackRecords: [] });

      return { experts: picked, plan: strategicPlan, explanation };
    } catch (err) {
      turnTelemetry.endSpan(SPAN_NAMES.ROUTER_COGNITIVE, { error: err.message });
      console.warn(ROUTER_MESSAGES.cognitiveFallback, err.message);
      return { 
        experts: clampTop(candidates, Math.min(ROUTER_LIMITS.maxCognitiveCandidates, ROUTER_BUDGETS.maxCognitiveCandidates)), 
        plan: '' 
      };
    }
  }

  async getExpertByKey(key, onProgress = null) {
    if (this.experts.size === 0) {
      await this.init(onProgress);
    }

    const target = normalizeKey(key);
    let manifest = null;

    for (const [fullKey, m] of this.experts) {
      const fk = normalizeKey(fullKey);
      const kk = normalizeKey(m.key);
      if (fk === target || kk === target) {
        manifest = m;
        break;
      }
    }

    if (!manifest) {
      console.log(`[Router] getExpertByKey('${key}') -> NOT FOUND`);
      return null;
    }

    if (this.runtimeCounters.hydratedExperts >= ROUTER_BUDGETS.maxHydratedExpertsPerTurn) {
      console.log(formatLayerLog(ROUTER_LAYERS.L3_EXPERT_HYDRATION, 'hydration budget reached, allowing targeted wake-up only', {
        budget: ROUTER_BUDGETS.maxHydratedExpertsPerTurn,
        requested: manifest.key
      }));
    }

    // HYDRATATION PARESSEUSE (Wake-up) via ManifestStore
    turnTelemetry.startSpan(SPAN_NAMES.ROUTER_HYDRATION, { expert: manifest.key });
    console.time(`expert:wake:${manifest.key}`);
    try {
      const fullExpert = await manifestStore.hydrateExpert(manifest);
      if (fullExpert) {
        this.runtimeCounters.hydratedExperts += 1;
        turnTelemetry.markLayer(ROUTER_LAYERS.L3_EXPERT_HYDRATION);
        turnTelemetry.setMetric('hydratedExperts', this.runtimeCounters.hydratedExperts);
        console.timeEnd(`expert:wake:${manifest.key}`);
        turnTelemetry.endSpan(SPAN_NAMES.ROUTER_HYDRATION, { success: true });
        return fullExpert;
      }
    } catch (err) {
      turnTelemetry.endSpan(SPAN_NAMES.ROUTER_HYDRATION, { success: false, error: err.message });
      console.error(`[Router] Hydration error for ${manifest.key}:`, err.message);
    }

    console.timeEnd(`expert:wake:${manifest.key}`);
    return null;
  }

  beginTurn() {
    this.runtimeCounters.hydratedExperts = 0;
  }
}

export default new ExpertRouter();
