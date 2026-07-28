import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * GitService - Service isolé pour la manipulation stricte et sécurisée des dépôts Git.
 * N'effectue aucune validation de politique (c'est le rôle de workspacePolicy), 
 * mais garantit que les commandes Git sont exécutées sans risque d'injection shell.
 */
export const GitService = {
    
    /**
     * Exécute une commande git en toute sécurité via execFile (anti-shell-injection).
     */
    async _runGit(args, cwd) {
        try {
            const { stdout, stderr } = await execFileAsync('git', args, { cwd });
            return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
        } catch (error) {
            return { success: false, error: error.message, stdout: error.stdout, stderr: error.stderr };
        }
    },

    /**
     * Vérifie si le répertoire donné est un dépôt Git valide.
     * @param {string} repoPath 
     * @returns {Promise<boolean>}
     */
    async isGitRepo(repoPath) {
        if (!fs.existsSync(repoPath)) return false;
        
        const result = await this._runGit(['rev-parse', '--is-inside-work-tree'], repoPath);
        return result.success && result.stdout === 'true';
    },

    /**
     * Crée un worktree Git lié au dépôt source.
     * @param {string} repoPath Le chemin du dépôt source
     * @param {string} branchName Le nom de la nouvelle branche
     * @param {string} targetPath Le chemin cible (isolé) où créer le worktree
     */
    async createWorktree(repoPath, branchName, targetPath) {
        // Commande: git worktree add -b <branchName> <targetPath>
        const result = await this._runGit(['worktree', 'add', '-b', branchName, targetPath], repoPath);
        if (!result.success) {
            throw new Error(`Échec de la création du worktree: ${result.stderr || result.error}`);
        }
        return true;
    },

    /**
     * Supprime un worktree Git existant.
     * @param {string} repoPath Le chemin du dépôt source d'où gérer le worktree
     * @param {string} targetPath Le chemin du worktree à supprimer
     * @param {boolean} force Force la suppression même s'il y a des fichiers non suivis
     */
    async removeWorktree(repoPath, targetPath, force = false) {
        const args = ['worktree', 'remove'];
        if (force) args.push('--force');
        args.push(targetPath);

        const result = await this._runGit(args, repoPath);
        if (!result.success) {
            throw new Error(`Échec de la suppression du worktree: ${result.stderr || result.error}`);
        }
        return true;
    },

    /**
     * Génère un diff (patch) des modifications dans le worktree et l'écrit dans un fichier.
     * @param {string} worktreePath Le chemin du worktree
     * @param {string} outputFile Le fichier de destination du patch (.patch)
     */
    async generatePatch(worktreePath, outputFile) {
        // git diff > outputFile
        const result = await this._runGit(['diff'], worktreePath);
        if (!result.success) {
            throw new Error(`Échec de la génération du diff: ${result.stderr || result.error}`);
        }
        
        await fs.promises.writeFile(outputFile, result.stdout, 'utf8');
        return true;
    },

    /**
     * Récupère le statut (git status --porcelain) du worktree.
     * @param {string} worktreePath 
     */
    async getStatus(worktreePath) {
        const result = await this._runGit(['status', '--porcelain'], worktreePath);
        if (!result.success) {
            throw new Error(`Échec du git status: ${result.stderr || result.error}`);
        }
        return result.stdout;
    },

    /**
     * Ajoute et commit tous les changements dans le worktree.
     * À n'appeler que si la policy a autorisé l'écriture.
     * @param {string} worktreePath 
     * @param {string} message Le message de commit
     */
    async commitInWorktree(worktreePath, message) {
        const addResult = await this._runGit(['add', '.'], worktreePath);
        if (!addResult.success) {
            throw new Error(`Échec de git add: ${addResult.stderr || addResult.error}`);
        }

        const commitResult = await this._runGit(['commit', '-m', message], worktreePath);
        if (!commitResult.success) {
            // Si stdout contient "nothing to commit", ce n'est pas forcément une erreur grave,
            // mais on la remonte quand même pour le flow appelant.
            throw new Error(`Échec de git commit: ${commitResult.stderr || commitResult.stdout || commitResult.error}`);
        }
        return true;
    }
};

export default GitService;
