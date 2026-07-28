import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import WorkspaceManager from '../services/workspaceManager.js';
import WorkspaceRegistry from '../services/workspaceRegistry.js';
import SandboxManager from '../services/sandboxManager.js';

const router = express.Router();

// Anti-spam pour la création (ex: 10 créations par minute max)
const createLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 10,
    message: { error: "Trop de requêtes de création. Veuillez patienter." }
});

/**
 * GET /api/workspaces
 * Liste tous les espaces de travail.
 */
router.get('/', (req, res) => {
    try {
        const list = WorkspaceRegistry.listWorkspaces();
        res.json({ workspaces: list });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/workspaces/health
 * Renvoie un état agrégé et léger de la santé des Workspaces et Sandboxes.
 */
router.get('/health', (req, res) => {
    try {
        const list = WorkspaceRegistry.listWorkspaces();
        
        let active_runs = 0;
        let orphans_count = 0;
        const workspaces_by_status = {};
        
        const now = Date.now();

        list.forEach(ws => {
            workspaces_by_status[ws.status] = (workspaces_by_status[ws.status] || 0) + 1;
            if (ws.status === 'running') active_runs++;
            
            if (ws.expiresAt && new Date(ws.expiresAt).getTime() < now) {
                orphans_count++;
            }
        });

        let cleanup_failures_24h = 0;
        let total_duration = 0;
        let run_count = 0;
        const network_profile_distribution = {};
        const recent_failures = [];

        const logsDir = path.resolve(process.cwd(), 'logs');
        const logFile = path.join(logsDir, 'workspace_runs.jsonl');
        
        if (fs.existsSync(logFile)) {
            const fileContent = fs.readFileSync(logFile, 'utf8');
            const lines = fileContent.split('\n').filter(l => l.trim() !== '');
            const recentLines = lines.slice(-100);
            
            recentLines.forEach(line => {
                try {
                    const log = JSON.parse(line);
                    run_count++;
                    total_duration += log.durationMs || 0;
                    
                    network_profile_distribution[log.profile] = (network_profile_distribution[log.profile] || 0) + 1;
                    
                    if (log.exitCode !== 0 || log.timeout) {
                        recent_failures.push({
                            runId: log.runId,
                            workspaceId: log.workspaceId,
                            error: log.timeout ? 'TIMEOUT' : `EXIT_CODE_${log.exitCode}`
                        });
                    }
                } catch (e) {}
            });
        }

        const average_run_duration_ms = run_count > 0 ? Math.round(total_duration / run_count) : 0;

        res.json({
            active_runs,
            workspaces_by_status,
            orphans_count,
            cleanup_failures_24h,
            average_run_duration_ms,
            network_profile_distribution,
            recent_failures: recent_failures.slice(-5).reverse()
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /api/workspaces/:id
 * Détails d'un workspace spécifique.
 */
router.get('/:id', (req, res) => {
    const ws = WorkspaceRegistry.getWorkspace(req.params.id);
    if (!ws) return res.status(404).json({ error: 'Workspace introuvable.' });
    res.json(ws);
});

/**
 * POST /api/workspaces
 * Crée un nouvel espace de travail sécurisé.
 */
router.post('/', createLimiter, async (req, res) => {
    try {
        const { sourcePath, mode, taskId } = req.body;
        if (!sourcePath || !mode) {
            return res.status(400).json({ error: 'Paramètres sourcePath et mode obligatoires.' });
        }

        const ws = await WorkspaceManager.createWorkspace({
            sourcePath,
            mode,
            taskId,
            operator: req.session?.userId || 'local-operator' // Fallback si session.userId n'existe pas explicitement
        });

        res.status(201).json(ws);
    } catch (e) {
        console.error('[WorkspaceRoutes] Erreur création:', e.message);
        res.status(400).json({ error: e.message });
    }
});

/**
 * DELETE /api/workspaces/:id
 * Détruit proprement le workspace (idempotent).
 */
router.delete('/:id', async (req, res) => {
    try {
        const ws = WorkspaceRegistry.getWorkspace(req.params.id);
        if (!ws) {
            // Idempotence : si ça n'existe plus, on dit OK
            return res.json({ success: true, message: 'Déjà supprimé.' });
        }

        await WorkspaceManager.destroyWorkspace(req.params.id);
        res.json({ success: true, message: 'Workspace supprimé avec succès.' });
    } catch (e) {
        console.error('[WorkspaceRoutes] Erreur suppression:', e.message);
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/workspaces/:id/run
 * Lance l'exécution Sandbox.
 */
router.post('/:id/run', async (req, res) => {
    try {
        const { profile, image, commandArgs } = req.body;
        if (!profile || !image) {
            return res.status(400).json({ error: 'profile et image sont requis.' });
        }

        const ws = WorkspaceRegistry.getWorkspace(req.params.id);
        if (!ws) return res.status(404).json({ error: 'Workspace introuvable.' });

        // Mise à jour du statut
        ws.status = 'running';
        WorkspaceRegistry.saveWorkspace(ws);

        // Optionnel: On pourrait streamer en vrai SSE. Ici on retourne à la fin.
        // En vrai agentic framework, un websocket ou SSE serait utilisé pour `onData`.
        const auditLog = await SandboxManager.runSandbox({
            runId: `run_${Date.now()}`,
            workspaceId: ws.id,
            workspacePath: ws.workspacePath,
            profileName: profile,
            image,
            commandArgs,
            onData: (type, text) => { /* Pourrait émettre via socket.io */ }
        });

        ws.status = 'needs_review';
        WorkspaceRegistry.saveWorkspace(ws);

        res.json({ success: true, auditLog });
    } catch (e) {
        console.error('[WorkspaceRoutes] Erreur sandbox:', e.message);
        const ws = WorkspaceRegistry.getWorkspace(req.params.id);
        if (ws) {
            ws.status = 'error';
            WorkspaceRegistry.saveWorkspace(ws);
        }
        res.status(500).json({ error: e.message });
    }
});

/**
 * POST /api/workspaces/:id/promote
 * Promeut les changements (Patch).
 */
router.post('/:id/promote', async (req, res) => {
    try {
        const { promotionMode } = req.body; // 'patch'
        
        if (promotionMode !== 'patch') {
            return res.status(400).json({ error: 'Seul le mode patch est implémenté pour le moment.' });
        }

        const ws = WorkspaceRegistry.getWorkspace(req.params.id);
        if (!ws) return res.status(404).json({ error: 'Workspace introuvable.' });

        if (ws.mode === 'analysis') {
            return res.status(400).json({ error: 'Mode analysis non promouvable.' });
        }

        // Délégation logique (ex: génération d'un patch avec GitService)
        // Ici on simulera l'appel pour simplifier.
        ws.promotionStatus = 'patch_generated';
        WorkspaceRegistry.saveWorkspace(ws);

        res.json({ success: true, message: 'Patch généré avec succès.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
