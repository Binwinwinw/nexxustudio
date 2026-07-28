import SandboxManager from '../src/services/sandboxManager.js';

describe('SandboxManager Security Tests', () => {
    
    const validWorkspacePath = '/tmp/citadelle/worktrees/mock';
    
    test('DOIT rejeter une image Docker hors allowlist', () => {
        expect(() => {
            SandboxManager._buildDockerArgs(validWorkspacePath, 'ubuntu:latest', 'analysis_readonly', []);
        }).toThrow(/non autorisée/);

        expect(() => {
            SandboxManager._buildDockerArgs(validWorkspacePath, 'node:20-alpine; rm -rf /', 'analysis_readonly', []);
        }).toThrow(/non autorisée/);
    });

    test('DOIT rejeter un profil inexistant', () => {
        expect(() => {
            SandboxManager._buildDockerArgs(validWorkspacePath, 'alpine:latest', 'hacker_mode', []);
        }).toThrow(/Profil Sandbox inconnu/);
    });

    test('DOIT forcer le réseau à "none" pour le profil analysis_readonly', () => {
        const args = SandboxManager._buildDockerArgs(validWorkspacePath, 'alpine:latest', 'analysis_readonly', []);
        expect(args).toContain('--network=none');
    });

    test('DOIT inclure systématiquement les sécurités Docker (non-root, cap-drop, no-new-privileges)', () => {
        const args = SandboxManager._buildDockerArgs(validWorkspacePath, 'alpine:latest', 'dev_patch', []);
        
        expect(args).toContain('--security-opt=no-new-privileges:true');
        expect(args).toContain('--cap-drop=ALL');
        expect(args).toContain('--user=1000:1000');
        expect(args).toContain('--read-only');
    });

    test('DOIT monter le volume workspace de manière appropriée (ro ou rw)', () => {
        const analysisArgs = SandboxManager._buildDockerArgs(validWorkspacePath, 'alpine:latest', 'analysis_readonly', []);
        expect(analysisArgs).toContain(`-v`);
        expect(analysisArgs).toContain(`${validWorkspacePath}:/workspace:ro`);

        const devArgs = SandboxManager._buildDockerArgs(validWorkspacePath, 'alpine:latest', 'dev_patch', []);
        expect(devArgs).toContain(`${validWorkspacePath}:/workspace:rw`);
    });

    test('NE DOIT PAS autoriser shell=true (indirectement, args array validé)', () => {
        // Le fait que _buildDockerArgs retourne un tableau d'arguments démontre
        // qu'on passe ces arguments à `spawn` en mode direct et non dans un shell.
        const args = SandboxManager._buildDockerArgs(validWorkspacePath, 'alpine:latest', 'dev_patch', ['ls', '-la']);
        expect(Array.isArray(args)).toBe(true);
        expect(args[args.length - 2]).toBe('ls');
        expect(args[args.length - 1]).toBe('-la');
    });
});
