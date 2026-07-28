/* server/src/services/validationService.js */
import eventRepository from '../db/repositories/eventRepository.js';
import snapshotRepository from '../db/repositories/snapshotRepository.js';
import handoffRepository from '../db/repositories/handoffRepository.js';
import sessionRepository from '../db/repositories/sessionRepository.js';
import pool from '../db/connection.js';

/**
 * Service de Validation et de Readiness (Industrial v4.0)
 * Gère la machine à états du projet et le passage à la Forge.
 */
export class ValidationService {
  constructor() {
    this.ACTOR_SYSTEM = 'system';
    this.ACTOR_ASSISTANT = 'assistant';
    this.READY_SIGNAL = '[READY]';
  }

  /**
   * Recalcule l'état du projet et vérifie s'il est prêt pour la Forge.
   * La version est calculée de manière DB-authoritative (SELECT MAX FOR UPDATE)
   * pour résister aux appels concurrents sans collision.
   */
  async validateProject(sessionId) {
    const events = await eventRepository.getEventsBySession(sessionId);
    const session = await sessionRepository.findById(sessionId);
    
    if (!session) throw new Error(`[Validation] Session [${sessionId}] introuvable.`);

    // 1. Extraire la structure du projet (Priorité aux données structurées)
    const projectState = this._extractProjectState(events);
    
    // 2. Calculer le score de maturité (Pondération 40/25/15/10/10)
    const stats = this._calculateReadinessScore(projectState, events);
    
    const state = {
      sessionId,
      lastUpdate: new Date().toISOString(),
      project: projectState,
      current_phase: 'DISCOVERY',
      metrics: {
        score: stats.score,
        details: stats.details,
        missing: stats.missing
      },
      signals: {
        ready_keyword: this._detectReadySignal(events),
        handoff_report_ready: projectState.handoff_report_ready
      },
      forge_ready: false
    };

    // --- MACHINE À ÉTAT DURCIE (HYSTÉRÉSIS) ---
    const previousPhase = session.current_phase || 'DISCOVERY';
    const currentScore = state.metrics.score;
    const hasReadySignal = state.signals.ready_keyword;

    let nextPhase = previousPhase;

    // Logique d'Entrée
    if (previousPhase === 'DISCOVERY' && currentScore >= 15) {
      nextPhase = 'VALIDATION';
    } else if (previousPhase === 'VALIDATION' && currentScore >= 80 && hasReadySignal) {
      nextPhase = 'READY_FOR_FORGE';
    }

    // Logique de Sortie (Hystérésis - évite les oscillations)
    if (previousPhase === 'READY_FOR_FORGE' && currentScore < 72) {
      nextPhase = 'VALIDATION';
    } else if (previousPhase === 'VALIDATION' && currentScore < 10) {
      nextPhase = 'DISCOVERY';
    }

    state.current_phase = nextPhase;
    
    // Protection contre la rétrogradation depuis un état actif
    if (['FORGE_RUNNING', 'FORGE_DONE'].includes(previousPhase)) {
      state.current_phase = previousPhase;
    }

    // 3. Persistance de la transition (Audit Trail) — version DB-authoritative
    // Pattern identique à recordEvent : on verrouille la ligne project_sessions
    // (FOR UPDATE sur une ligne stable = serializable sur InnoDB, pas sur un agrégat).
    if (state.current_phase !== previousPhase) {
      const conn = await pool.getConnection();
      let phaseTransitionVersion = null;
      try {
        await conn.beginTransaction();

        // Verrouiller la ligne de session (pattern identique à recordEvent)
        const lockedSession = await sessionRepository.findById(sessionId, conn, true);
        if (!lockedSession) throw new Error(`Session ${sessionId} disparue pendant la transition.`);

        phaseTransitionVersion = (lockedSession.last_event_version || 0) + 1;

        await sessionRepository.updatePhase(sessionId, state.current_phase, conn);
        await eventRepository.addEvent({
          sessionId,
          family: 'SYSTEM',
          type: 'phase_transition',
          actor: this.ACTOR_SYSTEM,
          payload: { 
            from: previousPhase, 
            to: state.current_phase,
            reason: `Readiness Score reached ${state.metrics.score}%`
          },
          version: phaseTransitionVersion
        }, conn);

        // Maintenir last_event_version à jour pour les écrivains suivants
        await sessionRepository.updateVersion(sessionId, phaseTransitionVersion, conn);

        await conn.commit();
        console.log(`[ValidationService] Phase Transition: ${previousPhase} -> ${state.current_phase} (Session: ${sessionId}, v${phaseTransitionVersion})`);
      } catch (transErr) {
        await conn.rollback();
        console.error(`[ValidationService] VALIDATION_EVENT_WRITE_FAILED | session=${sessionId} | attempted_version=${phaseTransitionVersion ?? 'unknown'} | error=${transErr.message}`);
        // Non-bloquant : on continue sans faire planter la validation
      } finally {
        conn.release();
      }
    }

    // 4. Preuve de Préparation (Contrat de Vérité)
    const readinessProof = this._checkReadinessProof(state.project);
    state.readiness_proof = readinessProof;

    state.forge_ready = (
      state.current_phase === 'READY_FOR_FORGE' &&
      readinessProof.isValid &&
      (projectState?.blocking_points || []).length === 0
    );

    // 5. Sauvegarde du Snapshot
    // Utiliser la version courante réelle de la session (DB-authoritative).
    const snapshotVersion = session.last_event_version || 0;
    await snapshotRepository.saveSnapshot(sessionId, state, snapshotVersion);

    // 6. Création de Handoff (Unicité garantie via Repo)
    if (state.forge_ready) {
      await handoffRepository.ensureUniqueHandoff(sessionId, {
        reason: "Nexxus Readiness Score >= 80 + [READY] signal",
        state_snapshot_version: snapshotVersion,
        project_summary: {
          title: projectState.project_title,
          goal: projectState.primary_goal,
          deliverables: projectState.deliverables
        }
      });
    }

    return state;
  }

  /**
   * Analyse les événements pour reconstruire l'état. 
   * Priorité aux métadonnées structurées transmises par l'assistant.
   */
  _extractProjectState(events) {
    const state = {
      project_title: null,
      project_type: null,
      primary_goal: null,
      deliverables: [],
      experts_required: [],
      blocking_points: [],
      handoff_report_ready: false,
      technical_stack: []
    };

    // Parcours des messages de l'assistant (récents en premier)
    const assistantEvents = events
      .filter(e => e.actor_type === this.ACTOR_ASSISTANT)
      .reverse();

    for (const event of assistantEvents) {
      const meta = event.payload_json?.meta || {};
      const content = event.payload_json?.content || "";

      // A. Extraction Structurée (Priorité 1)
      if (meta.project_title && !state.project_title) state.project_title = meta.project_title;
      if (meta.primary_goal && !state.primary_goal) state.primary_goal = meta.primary_goal;
      if (Array.isArray(meta.deliverables) && state.deliverables.length === 0) state.deliverables = meta.deliverables;
      if (Array.isArray(meta.technical_stack) && state.technical_stack.length === 0) state.technical_stack = meta.technical_stack;
      if (meta.handoff_ready === true) state.handoff_report_ready = true;

      // B. Fallback Regex (Priorité 2 - Sauvetage de données)
      if (!state.project_title) {
        const titleMatch = content.match(/(?:Projet|Project)\s*:\s*(.*)/i);
        if (titleMatch) state.project_title = titleMatch[1].trim();
      }

      if (!state.primary_goal) {
        const goalMatch = content.match(/(?:Objectif|Goal|But)\s*:\s*(.*)/i);
        if (goalMatch) state.primary_goal = goalMatch[1].trim();
      }

      // Collecte des livrables (si non trouvés en meta)
      if (state.deliverables.length === 0) {
        const deliverableMatches = content.match(/- \[ \] (.*)|- Livrable\s*:\s*(.*)/g);
        if (deliverableMatches) {
          state.deliverables = deliverableMatches.map(m => m.replace(/- \[ \] |- Livrable\s*:\s*/g, '').trim());
        }
      }

      // Signal de Handoff
      if (content.includes("# Directive technique pour la Forge") || content.includes("# Rapport de Handoff")) {
        state.handoff_report_ready = true;
      }
    }

    return state;
  }

  _calculateReadinessScore(state, events) {
    let score = 0;
    const details = {};
    const missing = [];

    // 1. Structure (40%)
    let structScore = 0;
    if (state.project_title) structScore += 10; else missing.push("Titre du projet");
    if (state.primary_goal) structScore += 15; else missing.push("Objectif principal");
    if (state.project_type || state.technical_stack.length > 0) structScore += 15; else missing.push("Type ou Stack technique");
    score += structScore;
    details.structure = structScore;

    // 2. Livrables (25%)
    let delivScore = 0;
    if (state.deliverables.length >= 1) delivScore += 10;
    if (state.deliverables.length >= 3) delivScore += 15;
    if (state.deliverables.length === 0) missing.push("Livrables");
    score += delivScore;
    details.deliverables = delivScore;

    // 3. Contraintes & Handoff (15%)
    let handoffScore = state.handoff_report_ready ? 15 : 0;
    if (handoffScore === 0) missing.push("Rapport de Handoff");
    score += handoffScore;
    details.handoff = handoffScore;

    // 4. Stabilité (20%)
    let stabilityScore = (events.length >= 5 && state.blocking_points.length === 0) ? 20 : 10;
    score += stabilityScore;
    details.stability = stabilityScore;

    return { score: Math.min(score, 100), details, missing };
  }

  _detectReadySignal(events) {
    return (events || []).some(e => 
      e.actor_type === this.ACTOR_ASSISTANT && 
      (e.payload_json?.content?.includes(this.READY_SIGNAL) || e.payload_json?.meta?.ready === true)
    );
  }

  _checkReadinessProof(project) {
    const criteria = {
      has_title: (project.project_title || '').length >= 5,
      has_goal: (project.primary_goal || '').length >= 30,
      has_stack: (project.technical_stack || []).length >= 1,
      has_deliverables: (project.deliverables || []).length >= 2,
      has_handoff: !!project.handoff_report_ready
    };

    const missing = Object.entries(criteria)
      .filter(([, value]) => !value)
      .map(([key]) => key.replace('has_', ''));

    return {
      isValid: missing.length === 0,
      criteria,
      missing
    };
  }
}

export default new ValidationService();
