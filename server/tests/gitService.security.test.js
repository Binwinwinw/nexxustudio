import GitService from '../src/services/gitService.js';
import * as child_process from 'child_process';
import { promisify } from 'util';

// Mock execFile to avoid running real git commands during tests
jest.mock('child_process', () => {
    return {
        execFile: jest.fn((cmd, args, options, callback) => {
            if (callback) callback(null, { stdout: 'mocked', stderr: '' });
            return { stdout: 'mocked', stderr: '' };
        })
    };
});

describe('GitService Security Tests', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('DOIT appeler execFile (sans shell) et non exec', async () => {
        const repoPath = '/tmp/repo';
        await GitService.createWorktree(repoPath, 'feature-1', '/tmp/worktree/1');
        
        expect(child_process.execFile).toHaveBeenCalled();
        expect(child_process.execFile.mock.calls[0][0]).toBe('git'); // L'exécutable doit être exactement 'git'
        expect(Array.isArray(child_process.execFile.mock.calls[0][1])).toBe(true); // Les args doivent être un tableau
    });

    test('NE DOIT PAS autoriser d\'injection d\'arguments via la branche', async () => {
        const repoPath = '/tmp/repo';
        // Une tentative d'injection: on passe un nom de branche "bizarre"
        // Comme execFile passe ça en argument unique à l'exécutable, ça échouera côté git, 
        // mais le shell ne l'interprétera pas !
        const maliciousBranch = '; rm -rf /'; 
        await GitService.createWorktree(repoPath, maliciousBranch, '/tmp/worktree/2');

        const args = child_process.execFile.mock.calls[0][1];
        expect(args).toContain(maliciousBranch); // L'argument est passé tel quel
        expect(args.some(a => a.includes('-c') || a.includes('sh'))).toBe(false); // Pas d'invocation de subshell
    });
});
