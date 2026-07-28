import request from 'supertest';
import express from 'express';
import workspaceRoutes from '../src/routes/workspaceRoutes.js';
import sessionAccessService from '../src/services/sessionAccessService.js';
import WorkspaceRegistry from '../src/services/workspaceRegistry.js';

// Mock dependencies
jest.mock('../src/services/sessionAccessService.js', () => ({
    ensureAccess: jest.fn((req, res, next) => next())
}));
jest.mock('../src/services/workspaceRegistry.js', () => ({
    listWorkspaces: jest.fn(() => []),
    getWorkspace: jest.fn(),
    saveWorkspace: jest.fn(),
    removeWorkspace: jest.fn()
}));
jest.mock('../src/services/workspaceManager.js', () => ({
    createWorkspace: jest.fn(),
    destroyWorkspace: jest.fn()
}));
jest.mock('../src/services/sandboxManager.js', () => ({
    runSandbox: jest.fn()
}));

const app = express();
app.use(express.json());

// Simulation du middleware de sécurité (requireSessionAccess + requireLocalOperator)
const mockRequireLocalOperator = (req, res, next) => {
    if (req.headers['x-mock-operator'] !== 'true') return res.status(403).json({ error: 'Opération locale requise' });
    next();
};

app.use('/api/workspaces', mockRequireLocalOperator, workspaceRoutes);

describe('WorkspaceRoutes Security Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('DOIT refuser l\'accès si le local operator n\'est pas vérifié', async () => {
        const response = await request(app).get('/api/workspaces');
        expect(response.status).toBe(403);
    });

    test('DOIT accepter l\'accès avec local operator', async () => {
        const response = await request(app)
            .get('/api/workspaces')
            .set('x-mock-operator', 'true');
        expect(response.status).toBe(200);
    });

    test('DELETE /:id DOIT être idempotent', async () => {
        // Le registry retourne null (le workspace n'existe pas)
        WorkspaceRegistry.getWorkspace.mockReturnValueOnce(null);

        const response = await request(app)
            .delete('/api/workspaces/ws_invalid_id')
            .set('x-mock-operator', 'true');
        
        expect(response.status).toBe(200);
        expect(response.body.message).toContain('Déjà supprimé');
    });

    test('POST /:id/run DOIT exiger profile et image', async () => {
        const response = await request(app)
            .post('/api/workspaces/ws_123/run')
            .set('x-mock-operator', 'true')
            .send({ commandArgs: ['ls'] });
            
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('profile et image sont requis');
    });

    test('POST /:id/promote DOIT bloquer les modes inconnus', async () => {
        const response = await request(app)
            .post('/api/workspaces/ws_123/promote')
            .set('x-mock-operator', 'true')
            .send({ promotionMode: 'hacker_mode' });
            
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Seul le mode patch est implémenté');
    });
});
