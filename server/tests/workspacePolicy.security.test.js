import fs from 'fs';
import path from 'path';
import WorkspacePolicy from '../src/policies/workspacePolicy.js';

describe('WorkspacePolicy Security Tests', () => {
    
    // Pour les tests, on s'assure qu'un faux dossier cible existe pour realpathSync,
    // sinon realpathSync lève une exception et le comportement "fail-closed" se déclenche.
    // Mais même sans création réelle, isPathAuthorized intercepte les erreurs et retourne false.
    
    test('DOIT refuser les racines systèmes (C:\\, etc.)', () => {
        expect(WorkspacePolicy.isPathAuthorized('C:\\')).toBe(false);
        expect(WorkspacePolicy.isPathAuthorized('C:\\Windows\\System32')).toBe(false);
        expect(WorkspacePolicy.isPathAuthorized('c:\\users\\admin')).toBe(false);
        expect(WorkspacePolicy.isPathAuthorized('/')).toBe(false);
    });

    test('DOIT refuser les attaques Path Traversal simples', () => {
        // Tentative d'évasion d'un path valide via ..
        const evasionPath = path.resolve(process.cwd(), '../projects/../../Windows');
        expect(WorkspacePolicy.isPathAuthorized(evasionPath)).toBe(false);
    });

    test('DOIT échouer de manière sécurisée (fail-closed) sur des chemins inexistants ou invalides', () => {
        expect(WorkspacePolicy.isPathAuthorized(null)).toBe(false);
        expect(WorkspacePolicy.isPathAuthorized('')).toBe(false);
        expect(WorkspacePolicy.isPathAuthorized('un/chemin/qui/n/existe/pas/du/tout/12345')).toBe(false);
    });

    test('DOIT accepter un sous-dossier de la whitelist (si existant)', () => {
        const allowedDir = path.resolve(process.cwd(), '../projects');
        
        // Simuler un dossier existant si possible ou s'assurer que la fonction retourne false s'il n'existe pas.
        // Puisque la politique est très stricte, si le dossier n'existe pas, il refusera via realpathSync exception.
        const nonExistentButAllowedPath = path.join(allowedDir, 'test-project');
        expect(WorkspacePolicy.isPathAuthorized(nonExistentButAllowedPath)).toBe(false); // Fail-closed car introuvable

        // Mais la racine elle-même existe et doit être autorisée
        expect(WorkspacePolicy.isPathAuthorized(allowedDir)).toBe(true);
    });

    test('DOIT limiter les profils réseau', () => {
        expect(WorkspacePolicy.isNetworkProfileAllowed('none')).toBe(true);
        expect(WorkspacePolicy.isNetworkProfileAllowed('local_only')).toBe(true);
        expect(WorkspacePolicy.isNetworkProfileAllowed('allowlist')).toBe(true);
        
        expect(WorkspacePolicy.isNetworkProfileAllowed('host')).toBe(false);
        expect(WorkspacePolicy.isNetworkProfileAllowed('bridge')).toBe(false);
        expect(WorkspacePolicy.isNetworkProfileAllowed('')).toBe(false);
    });

    test('DOIT accorder une durée de vie sécurisée par défaut', () => {
        expect(WorkspacePolicy.getMaxLifetime('analysis')).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
        expect(WorkspacePolicy.getMaxLifetime('unknown_mode')).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    test('DOIT refuser la promotion (merge/patch) du mode analysis', () => {
        expect(WorkspacePolicy.isPromotionAllowed('analysis')).toBe(false);
        expect(WorkspacePolicy.isPromotionAllowed('worktree')).toBe(true);
        expect(WorkspacePolicy.isPromotionAllowed('sandbox_copy')).toBe(true);
    });
});
