import fs from 'fs';
import path from 'path';

// Dossier racine local pour Citadelle, configuré dans l'environnement idéalement.
const CITADELLE_ROOT = path.resolve(process.cwd(), '../.citadelle'); 
const REGISTRY_FILE = path.join(CITADELLE_ROOT, 'workspaces', 'registry.json');

// S'assure que l'arborescence existe
if (!fs.existsSync(path.dirname(REGISTRY_FILE))) {
    fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
}

export const WorkspaceRegistry = {
    _load() {
        if (!fs.existsSync(REGISTRY_FILE)) return {};
        try {
            return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        } catch (error) {
            console.error('[Registry] Erreur lecture registre workspaces:', error);
            return {};
        }
    },

    _save(data) {
        fs.writeFileSync(REGISTRY_FILE, JSON.stringify(data, null, 2), 'utf8');
    },

    /**
     * Crée ou met à jour un enregistrement de workspace.
     */
    saveWorkspace(workspace) {
        const data = this._load();
        data[workspace.id] = {
            ...data[workspace.id],
            ...workspace,
            updatedAt: new Date().toISOString()
        };
        this._save(data);
    },

    /**
     * Récupère un workspace par son ID.
     */
    getWorkspace(id) {
        const data = this._load();
        return data[id] || null;
    },

    /**
     * Liste tous les workspaces.
     */
    listWorkspaces() {
        return Object.values(this._load());
    },

    /**
     * Supprime un enregistrement de workspace.
     */
    removeWorkspace(id) {
        const data = this._load();
        if (data[id]) {
            delete data[id];
            this._save(data);
        }
    }
};

export default WorkspaceRegistry;
