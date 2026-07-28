import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Catalogue des profils de sandbox stricts.
 */
const SANDBOX_PROFILES = {
    analysis_readonly: {
        network: 'none',
        readOnlyRoot: true,
        workspaceMountMode: 'ro', // Read-Only
        timeoutMs: 1000 * 60 * 15 // 15 minutes max
    },
    dev_patch: {
        network: 'none',
        readOnlyRoot: true,
        workspaceMountMode: 'rw', // Read-Write
        timeoutMs: 1000 * 60 * 30 // 30 minutes max
    },
    local_only: {
        network: 'host', // En local sur Windows/Docker, 'host' permet d'accéder au localhost hôte. À restreindre en prod !
        readOnlyRoot: true,
        workspaceMountMode: 'rw',
        timeoutMs: 1000 * 60 * 30
    }
};

/**
 * Allowlist stricte des images Docker autorisées pour éviter l'exécution de conteneurs arbitraires.
 */
const ALLOWED_IMAGES = [
    'node:20-alpine',
    'python:3.11-alpine',
    'alpine:latest'
];

/**
 * SandboxManager - Gère l'exécution isolée et éphémère d'agents ou de tâches.
 */
export const SandboxManager = {

    /**
     * Valide l'image demandée.
     */
    _validateImage(image) {
        if (!ALLOWED_IMAGES.includes(image)) {
            throw new Error(`Image Docker non autorisée : ${image}`);
        }
        return image;
    },

    /**
     * Valide le profil demandé.
     */
    _getProfile(profileName) {
        const profile = SANDBOX_PROFILES[profileName];
        if (!profile) {
            throw new Error(`Profil Sandbox inconnu : ${profileName}`);
        }
        return profile;
    },

    /**
     * Persiste asynchronement le log d'exécution dans le fichier JSONL.
     */
    _persistLog(auditLog) {
        try {
            const logsDir = path.resolve(process.cwd(), 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            const logFile = path.join(logsDir, 'workspace_runs.jsonl');
            fs.appendFileSync(logFile, JSON.stringify(auditLog) + '\n', 'utf8');
        } catch (err) {
            console.error('[SandboxManager] Erreur lors de la persistance du log:', err.message);
        }
    },

    /**
     * Construit les arguments de la commande docker run de manière déterministe et sécurisée.
     */
    _buildDockerArgs(workspacePath, image, profileName, commandArgs) {
        const profile = this._getProfile(profileName);
        
        // Configuration de sécurité hardcore
        const args = [
            'run',
            '--rm', // Éphémère
            '-i', // Interactif pour stream
            '--security-opt=no-new-privileges:true',
            '--cap-drop=ALL',
            `--network=${profile.network}`,
            '--memory=512m',
            '--cpus=1.0',
            '--pids-limit=100'
        ];

        // Utilisateur non-root (1000 par défaut sur beaucoup d'images)
        args.push('--user=1000:1000');

        if (profile.readOnlyRoot) {
            args.push('--read-only');
            // Montage d'un tmpfs pour /tmp qui est souvent requis
            args.push('--tmpfs=/tmp:rw,nosuid,nodev,exec,size=100m');
        }

        // Montage strict du workspace ciblé, jamais du home
        const mountOpt = profile.workspaceMountMode === 'ro' ? 'ro' : 'rw';
        args.push(`-v`, `${workspacePath}:/workspace:${mountOpt}`);
        args.push('-w', '/workspace');

        args.push(this._validateImage(image));

        // Ajout de la commande finale
        if (Array.isArray(commandArgs) && commandArgs.length > 0) {
            args.push(...commandArgs);
        }

        return args;
    },

    /**
     * Lance l'exécution dans la sandbox et stream les logs.
     * @param {Object} params
     * @param {string} params.runId ID de l'exécution pour traçabilité
     * @param {string} params.workspaceId ID du workspace (pour audit)
     * @param {string} params.workspacePath Chemin réel du dossier autorisé
     * @param {string} params.profileName Nom du profil (ex: 'analysis_readonly')
     * @param {string} params.image Nom de l'image (ex: 'node:20-alpine')
     * @param {Array} params.commandArgs Tableau d'arguments de commande (ex: ['npm', 'test'])
     * @param {Function} params.onData Callback appelé avec (type, data) où type est 'stdout' ou 'stderr'
     */
    async runSandbox({ runId, workspaceId, workspacePath, profileName, image, commandArgs, onData }) {
        return new Promise((resolve, reject) => {
            console.log(`[SandboxManager] Démarrage run ${runId} (WS: ${workspaceId}, Profil: ${profileName})`);
            
            let args;
            try {
                args = this._buildDockerArgs(workspacePath, image, profileName, commandArgs);
            } catch (err) {
                return reject(err);
            }

            const profile = this._getProfile(profileName);
            const startTime = Date.now();

            // Utilisation de spawn pour streamer la sortie (pas de shell=true par sécurité)
            const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });

            let isTimeout = false;
            let timeoutHandle = null;

            if (profile.timeoutMs) {
                timeoutHandle = setTimeout(() => {
                    isTimeout = true;
                    console.warn(`[SandboxManager] Timeout atteint pour run ${runId}. Kill forcé.`);
                    child.kill('SIGKILL'); // Tente de tuer le client docker
                }, profile.timeoutMs);
            }

            if (onData) {
                child.stdout.on('data', (data) => onData('stdout', data.toString()));
                child.stderr.on('data', (data) => onData('stderr', data.toString()));
            }

            child.on('close', (code) => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                
                const endTime = Date.now();
                const durationMs = endTime - startTime;

                const auditLog = {
                    runId,
                    workspaceId,
                    profile: profileName,
                    image,
                    commandArgs,
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date(endTime).toISOString(),
                    durationMs,
                    exitCode: code,
                    timeout: isTimeout
                };

                this._persistLog(auditLog);
                console.log(`[SandboxManager] Fin du run ${runId} (Code: ${code}, Timeout: ${isTimeout})`);
                resolve(auditLog);
            });

            child.on('error', (err) => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                console.error(`[SandboxManager] Erreur processus run ${runId}:`, err.message);
                reject(err);
            });
        });
    }
};

export default SandboxManager;
