import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { auditRuntimeModules } from './skillRuntimeRegistry.js';

export const SKILLS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../data/skills',
);

function parseDisabledSkillsEnv() {
  return String(process.env.SKILLS_DISABLED || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * skillLoader.js — ADR-007 v1.6
 * intent-first, doNotUseWhen, feature flags, fallbackSkillId, runtime audit
 */
class SkillLoader {
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
    this.loadedSkills = new Map();
    this.metaCache = null;
    this.runtimeAuditDone = false;
  }

  invalidateCache() {
    this.metaCache = null;
    this.loadedSkills.clear();
    this.runtimeAuditDone = false;
  }

  _logRuntimeAudit(metas) {
    if (this.runtimeAuditDone) return;
    this.runtimeAuditDone = true;

    const warnings = [];
    for (const meta of metas) {
      warnings.push(...auditRuntimeModules(meta.id, meta));
    }

    if (warnings.length === 0) return;

    console.warn(`[SkillLoader v1.6] ${warnings.length} alerte(s) runtimeModules:`);
    for (const warning of warnings) {
      console.warn(
        `[SkillLoader v1.6] [${warning.code}] ${warning.skill}: ${warning.message}`,
      );
    }
  }

  _isSkillDisabled(meta) {
    if (meta.enabled === false) return true;
    return parseDisabledSkillsEnv().includes(meta.id);
  }

  _matchesDoNotUseWhen(meta, query = '', context = {}) {
    const normalizedQuery = String(query).toLowerCase();

    for (const rule of meta.doNotUseWhen || []) {
      if (rule.type === 'queryContains') {
        const patterns = rule.patterns || (rule.pattern ? [rule.pattern] : []);
        if (
          patterns.some((p) =>
            normalizedQuery.includes(String(p).toLowerCase()),
          )
        ) {
          return true;
        }
      }

      if (rule.type === 'queryMatches' && rule.pattern) {
        try {
          if (new RegExp(rule.pattern, 'i').test(query)) return true;
        } catch {
          console.warn(`[SkillLoader] RegExp invalide doNotUseWhen (${meta.id})`);
        }
      }

      if (rule.type === 'intentId') {
        const intentId = context.intentContractId || context.intentId;
        if (rule.not && intentId === rule.not) return true;
        if (rule.value && intentId === rule.value) return true;
      }

      if (rule.type === 'envFlag' && rule.value) {
        if (process.env[rule.value] === 'true') return true;
      }
    }

    return false;
  }

  _isSkillEligible(meta, query, context) {
    if (this._isSkillDisabled(meta)) return false;
    if (this._matchesDoNotUseWhen(meta, query, context)) return false;
    return true;
  }

  _resolveWithFallback(meta, query, context, metas) {
    if (this._isSkillEligible(meta, query, context)) return meta.id;

    const fallbackId = meta.fallbackSkillId;
    if (!fallbackId) return null;

    const fallback = metas.find((m) => m.id === fallbackId);
    if (!fallback) return null;
    if (!this._isSkillEligible(fallback, query, context)) return null;
    return fallback.id;
  }

  async _loadAllMeta() {
    if (this.metaCache) return this.metaCache;

    const entries = await fs.readdir(this.skillsDir, { withFileTypes: true });
    const skillIds = entries
      .filter((e) => e.isDirectory() && e.name.startsWith('skill-'))
      .map((e) => e.name);

    const metas = [];
    for (const id of skillIds) {
      try {
        const raw = await fs.readFile(
          path.join(this.skillsDir, id, 'meta.json'),
          'utf-8',
        );
        const meta = JSON.parse(raw);
        metas.push({ id, ...meta });
      } catch (error) {
        console.warn(`[SkillLoader] meta.json illisible pour ${id}:`, error.message);
      }
    }

    this.metaCache = metas;
    this._logRuntimeAudit(metas);
    return metas;
  }

  async loadSkill(skillId) {
    if (this.loadedSkills.has(skillId)) return this.loadedSkills.get(skillId);

    const skillPath = path.join(this.skillsDir, skillId);
    try {
      const meta = JSON.parse(
        await fs.readFile(path.join(skillPath, 'meta.json'), 'utf-8'),
      );
      const logic = await fs.readFile(path.join(skillPath, 'SKILL.md'), 'utf-8');
      const checklist = await fs.readFile(
        path.join(skillPath, 'checklist.md'),
        'utf-8',
      );

      const fullSkill = {
        id: skillId,
        name: meta.name,
        version: meta.version,
        tier: meta.tier || 'specialized',
        priority: meta.priority || 0,
        intentIds: meta.intentIds || [],
        doNotUseWhen: meta.doNotUseWhen || [],
        fallbackSkillId: meta.fallbackSkillId || null,
        parentSkillId: meta.parentSkillId || null,
        subSkills: meta.subSkills || [],
        enabled: meta.enabled !== false,
        logic,
        checklist,
        triggers: meta.triggers || [],
      };

      this.loadedSkills.set(skillId, fullSkill);
      return fullSkill;
    } catch (error) {
      console.error(`[SkillLoader] Erreur lors du chargement du skill : ${skillId}`, error);
      return null;
    }
  }

  /**
   * Identifie le skill le plus pertinent.
   * 1) intentContractId → intentIds (priority desc), doNotUseWhen, fallback
   * 2) triggers spécialisés (score), doNotUseWhen, fallback
   * 3) tier fallback
   */
  async identifyRelevantSkill(query = '', context = {}) {
    const normalizedQuery = String(query).toLowerCase();
    const intentId = context.intentContractId || context.intentId || null;
    const metas = await this._loadAllMeta();
    const specialized = metas.filter((m) => m.tier !== 'fallback');

    if (intentId) {
      const intentMatches = specialized
        .filter(
          (m) => Array.isArray(m.intentIds) && m.intentIds.includes(intentId),
        )
        .map((meta) => {
          let triggerBoost = 0;
          for (const trigger of meta.triggers || []) {
            const token = String(trigger).toLowerCase();
            if (token && normalizedQuery.includes(token)) {
              triggerBoost = Math.max(triggerBoost, token.length);
            }
          }
          return { meta, score: (meta.priority || 0) + triggerBoost };
        })
        .sort((a, b) => b.score - a.score);

      for (const { meta } of intentMatches) {
        const resolved = this._resolveWithFallback(meta, query, context, metas);
        if (resolved) return resolved;
      }
    }

    let bestMeta = null;
    let bestScore = 0;

    for (const meta of specialized) {
      for (const trigger of meta.triggers || []) {
        const token = String(trigger).toLowerCase();
        if (!token || !normalizedQuery.includes(token)) continue;

        const score = token.length + (meta.priority || 0);
        if (score > bestScore) {
          bestScore = score;
          bestMeta = meta;
        }
      }
    }

    if (bestMeta) {
      const resolved = this._resolveWithFallback(bestMeta, query, context, metas);
      if (resolved) return resolved;
    }

    for (const meta of metas.filter((m) => m.tier === 'fallback')) {
      if (!this._isSkillEligible(meta, query, context)) continue;
      const matched = (meta.triggers || []).some((trigger) =>
        normalizedQuery.includes(String(trigger).toLowerCase()),
      );
      if (matched) return meta.id;
    }

    return null;
  }
}

export default new SkillLoader(SKILLS_DIR);
