import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Workspace Policy - Couche de sécurité pour l'isolation des agents.
 * Définit les règles d'accès, la whitelist des chemins et les profils réseau.
 */

// Configuration de la whitelist des racines autorisées.
// En production, cela pourrait venir d'une variable d'environnement ou d'un fichier de config sécurisé.
const ALLOWED_ROOTS = [
    path.resolve(process.cwd(), '../projects'), // La forge locale
    'D:\\Hostinger\\public_html' // Root de développement standard selon le contexte
].map(p => path.normalize(p).toLowerCase());

// Racines formellement interdites (fail-safe)
const FORBIDDEN_ROOTS = [
    'c:\\',
    'c:\\windows',
    'c:\\users',
    os.homedir().toLowerCase(),
    '/'
].map(p => path.normalize(p).toLowerCase());

export const WorkspacePolicy = {
    /**
     * Valide de manière stricte si un chemin est autorisé à devenir un workspace.
     * Applique la canonicalisation pour contrer le path traversal et l'escape par symlink.
     * 
     * @param {string} inputPath Le chemin brut fourni par l'utilisateur ou le système
     * @returns {boolean} true si le chemin est sûr et autorisé
     */
    isPathAuthorized(inputPath) {
        if (!inputPath) return false;

        try {
            // 1. Résolution canonique (résout les .. et les liens symboliques si le dossier existe)
            // S'il n'existe pas encore, path.resolve fera le minimum, mais realSync plantera.
            // On s'attend à ce que le workspace source existe au moment de l'analyse.
            let resolvedPath = path.resolve(inputPath);
            
            if (fs.existsSync(resolvedPath)) {
                resolvedPath = fs.realpathSync(resolvedPath);
            }
            
            const normalizedPath = resolvedPath.toLowerCase();

            // 2. Vérification des racines interdites (Blacklist prioritaire)
            for (const forbidden of FORBIDDEN_ROOTS) {
                if (normalizedPath === forbidden || normalizedPath.startsWith(forbidden + path.sep)) {
                    console.warn(`[Security] Accès bloqué par la policy (Blacklist) : ${inputPath}`);
                    return false;
                }
            }

            // 3. Vérification de la Whitelist
            let isWhitelisted = false;
            for (const allowed of ALLOWED_ROOTS) {
                if (normalizedPath === allowed || normalizedPath.startsWith(allowed + path.sep)) {
                    isWhitelisted = true;
                    break;
                }
            }

            if (!isWhitelisted) {
                console.warn(`[Security] Accès bloqué par la policy (Hors Whitelist) : ${inputPath}`);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`[Security] Erreur lors de la validation du chemin ${inputPath}:`, error.message);
            return false; // Fail-closed
        }
    },

    /**
     * Vérifie si le mode réseau est autorisé par la policy.
     * @param {string} networkProfile 'none', 'local_only', ou 'allowlist'
     */
    isNetworkProfileAllowed(networkProfile) {
        const allowedProfiles = ['none', 'local_only', 'allowlist'];
        return allowedProfiles.includes(networkProfile);
    },

    /**
     * Retourne la durée de vie maximale (en ms) d'un workspace selon son mode.
     * @param {string} mode 'analysis', 'worktree', 'sandbox_copy'
     */
    getMaxLifetime(mode) {
        switch (mode) {
            case 'analysis':
                return 1000 * 60 * 60 * 2; // 2 heures
            case 'worktree':
                return 1000 * 60 * 60 * 24 * 7; // 7 jours (jusqu'à validation humaine)
            case 'sandbox_copy':
                return 1000 * 60 * 60 * 24; // 24 heures
            default:
                return 1000 * 60 * 60; // 1 heure par défaut (fail-safe)
        }
    },

    /**
     * Vérifie si une promotion (merge/patch) est autorisée pour ce type de workspace.
     */
    isPromotionAllowed(mode) {
        return mode === 'worktree' || mode === 'sandbox_copy';
    }
};

export default WorkspacePolicy;
