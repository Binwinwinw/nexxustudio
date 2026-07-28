import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import WorkspacePolicy from '../policies/workspacePolicy.js';
import GitService from './gitService.js';
import WorkspaceRegistry from './workspaceRegistry.js';

const CITADELLE_ROOT = path.resolve(process.cwd(), '../.citadelle');

/**
 * WorkspaceManager - Orchestrateur du cycle de vie des espaces de travail.
 * Ne contient pas la logique de sécurité brute (déléguée à workspacePolicy)
 * ni la commande git brute (déléguée à gitService).
 */
export const WorkspaceManager = {

    /**
     * Valide de manière stricte le nom pour éviter toute injection ou anomalie FS.
     */
    _isValidSlug(slug) {
        return /^[a-zA-Z0-9._-]+$/.test(slug);
    },

    /**
     * Calcule le slug du projet à partir du chemin source.
     */
    _getProjectSlug(sourcePath) {
        return path.basename(sourcePath).replace(/[^a-zA-Z0-9._-]/g, '_');
    },

    /**
     * Crée un nouvel espace de travail sécurisé (Analysis, Git Worktree ou Sandbox).
     */
    async createWorkspace({ sourcePath, mode, taskId, operator = 'local-operator' }) {
        // 1. Validation de la Politique de Sécurité
        if (!WorkspacePolicy.isPathAuthorized(sourcePath)) {
            throw new Error(`Chemin source refusé par la politique de sécurité : ${sourcePath}`);
        }

        if (!['analysis', 'worktree', 'sandbox_copy'].includes(mode)) {
            throw new Error(`Mode invalide : ${mode}`);
        }

        if (taskId && !this._isValidSlug(taskId)) {
            throw new Error('Le taskId contient des caractères invalides.');
        }

        const resolvedSource = fs.realpathSync(path.resolve(sourcePath));
        const projectSlug = this._getProjectSlug(resolvedSource);
        const finalTaskId = taskId || `task-${Date.now()}`;
        const workspaceId = `ws_${projectSlug}_${finalTaskId}_${randomUUID().split('-')[0]}`;

        let workspacePath = resolvedSource; // Pour l'analyse seule
        let repoType = 'non_git';
        let branch = null;

        // 2. Gestion spécifique selon le mode
        if (mode === 'worktree') {
            const isGit = await GitService.isGitRepo(resolvedSource);
            if (!isGit) throw new Error("Le mode 'worktree' nécessite un dépôt Git valide.");
            
            repoType = 'git';
            branch = `citadelle/${finalTaskId}`;
            workspacePath = path.join(CITADELLE_ROOT, 'worktrees', projectSlug, finalTaskId);

            // Vérification de collision
            if (fs.existsSync(workspacePath)) {
                throw new Error(`Le chemin de worktree existe déjà (Collision) : ${workspacePath}`);
            }

            // Création physique du worktree
            fs.mkdirSync(path.dirname(workspacePath), { recursive: true });
            await GitService.createWorktree(resolvedSource, branch, workspacePath);

        } else if (mode === 'sandbox_copy') {
            workspacePath = path.join(CITADELLE_ROOT, 'sandboxes', workspaceId);
            
            // Vérification de collision
            if (fs.existsSync(workspacePath)) {
                throw new Error(`Le chemin de sandbox existe déjà : ${workspacePath}`);
            }

            // Copie physique contrôlée
            fs.cpSync(resolvedSource, workspacePath, { recursive: true });
            
            const isGit = await GitService.isGitRepo(workspacePath);
            if (isGit) repoType = 'git'; // Le clone est un repo git interne

        } else if (mode === 'analysis') {
            // Pas de copie physique, on utilise la source en read-only logique.
            repoType = await GitService.isGitRepo(resolvedSource) ? 'git' : 'non_git';
        }

        // 3. Enregistrement dans le Registre (Audit Trail)
        const workspaceData = {
            id: workspaceId,
            mode,
            sourcePath: resolvedSource,
            workspacePath,
            repoType,
            branch,
            status: 'ready',
            networkProfile: 'none',
            createdBy: operator,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + WorkspacePolicy.getMaxLifetime(mode)).toISOString(),
            promotionStatus: null
        };

        WorkspaceRegistry.saveWorkspace(workspaceData);
        console.log(`[WorkspaceManager] Workspace créé: ${workspaceId} en mode ${mode}`);

        return workspaceData;
    },

    /**
     * Détruit proprement un espace de travail.
     */
    async destroyWorkspace(id) {
        const ws = WorkspaceRegistry.getWorkspace(id);
        if (!ws) throw new Error(`Workspace introuvable : ${id}`);

        if (ws.mode === 'worktree') {
            try {
                // Le remove nettoiera le dossier via git
                await GitService.removeWorktree(ws.sourcePath, ws.workspacePath, true);
            } catch (err) {
                console.warn(`[WorkspaceManager] Erreur Git lors de la suppression, fallback rm : ${err.message}`);
                if (fs.existsSync(ws.workspacePath)) fs.rmSync(ws.workspacePath, { recursive: true, force: true });
            }
        } else if (ws.mode === 'sandbox_copy') {
            if (fs.existsSync(ws.workspacePath)) fs.rmSync(ws.workspacePath, { recursive: true, force: true });
        }

        // Mode analysis ne supprime rien du disque source.

        WorkspaceRegistry.removeWorkspace(id);
        console.log(`[WorkspaceManager] Workspace détruit: ${id}`);
        return true;
    }
};

export default WorkspaceManager;
