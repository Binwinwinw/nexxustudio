import searchTool from '../../tools/searchTool.js';
import projectBuilder from '../../tools/projectBuilder.js';
import { memoryOrchestrator } from '../memory/MemoryOrchestrator.js';
import workspaceScanner from '../../tools/workspaceScanner.js';
import pulseEngine from '../../tools/pulseEngine.js';
import vaultManager from '../../tools/vaultManager.js';
import projectScanner from '../../tools/projectScanner.js';
import fs from 'fs-extra';
import path from 'path';
import { isToolAvailable } from './toolRegistry.js';
import toolGuard from '../harness/toolGuard.js';
import { spawnSync } from 'child_process';
import FileSafety from '../../security/fileSafety.js';
import {
  executePrivilegedAction,
  mapToolInvocationToAction,
  formatGateBlockedMessage,
} from '../../hooks/privilegedActionGate.js';
import {
  graphifyQuery,
  graphifyPath,
  graphifyExplain,
  formatGraphifyToolResult,
} from '../capabilities/graphify/graphifyCli.js';
import {
  ocrPageRequest,
  ocrDocumentRequest,
  parseOcrToolPayload,
  formatOcrToolResult,
} from '../capabilities/ocr/ocrClient.js';

const PROJECT_ROOT = path.resolve(process.cwd(), '..');

class ToolExecutor {
  async execute(actionString, context = {}) {
    try {
      console.log(`[ToolExecutor] 🛠️ Executing action: ${actionString}`);
      
      const match = actionString.match(/^([a-zA-Z0-9_]+)\((.*)\)$/s);
      if (!match) {
        return `ERREUR : Format d'action invalide. Reçu: ${actionString}`;
      }

      const toolName = match[1];
      const argsRaw = match[2];
      const args = this.parseArgs(argsRaw);

      return await this.executeDirect(toolName, args, context);
    } catch (error) {
      console.error(`[ToolExecutor] Execution failed:`, error);
      return `ERREUR lors de l'exécution de l'outil : ${error.message}`;
    }
  }

  async executeDirect(toolName, args, context = {}) {
    let result = "";
    try {
      const getArg = (idx, key) => {
        if (Array.isArray(args)) return args[idx];
        if (typeof args === 'object' && args !== null) return args[key] || args[idx];
        return args;
      };

      // 1. Télémétrie
      const turnTelemetry = (await import('../telemetry/turnTelemetry.js')).default;
      const currentTools = turnTelemetry.metrics.toolsUsed || [];
      turnTelemetry.setMetric('toolsUsed', [...currentTools, toolName]);

      // 2. Validation Registry
      if (!isToolAvailable(toolName)) {
        return `ERREUR : L'outil [${toolName}] n'est pas autorisé dans La Citadelle.`;
      }

      // 3. 🛡️ POLICY ENFORCEMENT (Veto & Sequence Guard)
      const activeExpert = context.activeExpert;
      const guardResult = await toolGuard.validate(toolName, args, activeExpert, context);
      
      if (!guardResult.allowed) {
        return guardResult.reason;
      }

      const privilegedAction = mapToolInvocationToAction(toolName, args, {
        ...context,
        source: 'toolExecutor',
        projectRoot: PROJECT_ROOT,
      });

      const gateOutcome = await executePrivilegedAction(
        privilegedAction,
        async () => this._runToolHandler(toolName, args, context),
      );

      if (!gateOutcome.success) {
        return formatGateBlockedMessage(gateOutcome);
      }

      result = gateOutcome.result;

      // 4. RECORD EXECUTION & RETURN
      toolGuard.recordExecution(toolName, args, result, context);
      return result;

    } catch (error) {
      return `ERREUR lors de l'exécution de l'outil : ${error.message}`;
    }
  }

  async _runToolHandler(toolName, args, context = {}) {
    let result = "";
    const getArg = (idx, key) => {
      if (Array.isArray(args)) return args[idx];
      if (typeof args === 'object' && args !== null) return args[key] || args[idx];
      return args;
    };

    switch (toolName) {
        case 'webSearch':
          result = await searchTool.search(getArg(0, 'query'), getArg(1, 'limit') || 5);
          break;
        
        case 'webSummarize':
          result = await searchTool.summarize(getArg(0, 'url'));
          break;
        
        case 'librarianSearch':
          // ADR-20260705 Option B — heritage via Knowledge Hub, pas projectLibrary
          result = JSON.stringify(await memoryOrchestrator.getRelevantMemory(getArg(0, 'query'), { scope: 'heritage' }), null, 2);
          break;

        case 'workspaceSearch':
          result = JSON.stringify(await workspaceScanner.scan(getArg(0, 'path') || getArg(0, 'query')), null, 2);
          break;

        case 'pulse':
          result = JSON.stringify(await pulseEngine.scanProject(getArg(0, 'directory') || 'src'), null, 2);
          break;

        case 'knowledgeSearch':
          result = JSON.stringify(await memoryOrchestrator.getRelevantMemory(getArg(0, 'query')), null, 2);
          break;

        case 'buildProject':
          result = await projectBuilder.build(getArg(0, 'projectName'), getArg(1, 'files'));
          break;

        case 'writeFile':
          try {
            const pathArg = getArg(0, 'path');
            const contentArg = getArg(1, 'content');
            
            // 🛡️ SÉCURITÉ UNIFORMISÉE (Citadelle v4.2)
            const target = FileSafety.validatePath(PROJECT_ROOT, pathArg);

            await fs.ensureDir(path.dirname(target));
            await fs.writeFile(target, contentArg, 'utf8');
            result = `✅ Fichier écrit avec succès : ${pathArg}`;
          } catch (error) {
            result = `❌ ÉCHEC Écriture fichier : ${error.message}`;
          }
          break;


        case 'validateLint':
          try {
            const target = getArg(0, 'path') || '.';
            const fullPath = path.resolve(PROJECT_ROOT, target);
            
            // 🛡️ SÉCURITÉ : Pas d'interpolation de commande (spawnSync)
            const lintProcess = spawnSync('npx', ['eslint', fullPath], { 
              encoding: 'utf8', 
              cwd: PROJECT_ROOT 
            });

            if (lintProcess.status === 0) {
              result = `✅ Validation LINT réussie pour [${target}].`;
            } else {
              result = `❌ ÉCHEC Validation LINT :\n${lintProcess.stdout || lintProcess.stderr}`;
            }
          } catch (error) {
            result = `❌ ÉCHEC Critique LINT : ${error.message}`;
          }
          break;

        case 'validateBuild':
          try {
            const buildProcess = spawnSync('npm', ['run', 'build'], { 
              encoding: 'utf8', 
              cwd: PROJECT_ROOT 
            });
            if (buildProcess.status === 0) {
              result = `✅ Validation BUILD réussie.`;
            } else {
              result = `❌ ÉCHEC Validation BUILD :\n${buildProcess.stdout || buildProcess.stderr}`;
            }
          } catch (error) {
            result = `❌ ÉCHEC Critique BUILD : ${error.message}`;
          }
          break;

        case 'registerInDashboard':
          result = JSON.stringify(await vaultManager.registerInDashboard(getArg(0, 'type'), getArg(1, 'name'), getArg(2, 'metadata')), null, 2);
          break;

        case 'projectScan':
          result = JSON.stringify(await projectScanner.scanProjects(), null, 2);
          break;

        case 'promoteProject':
          const projectMemoryPromoter = (await import('../../tools/projectMemoryPromoter.js')).default;
          result = JSON.stringify(await projectMemoryPromoter.promote(getArg(0, 'projectId')), null, 2);
          break;

        case 'generateImage':
          const creativeService = (await import('../../services/CreativeGeneratorService.js')).default;
          result = JSON.stringify(await creativeService.generateImage(getArg(0, 'prompt'), getArg(1, 'options') ? JSON.parse(getArg(1, 'options')) : {}), null, 2);
          break;

        case 'generateAudio':
          const creativeAudioService = (await import('../../services/CreativeGeneratorService.js')).default;
          result = JSON.stringify(await creativeAudioService.generateAudio(getArg(0, 'prompt')), null, 2);
          break;

        case 'graph_query': {
          const runQ = graphifyQuery(getArg(0, 'question') || getArg(0, 'query') || getArg(0));
          result = formatGraphifyToolResult(runQ, 'graph_query');
          break;
        }
        case 'graph_path': {
          const runP = graphifyPath(getArg(0, 'source') || getArg(0), getArg(1, 'target') || getArg(1));
          result = formatGraphifyToolResult(runP, 'graph_path');
          break;
        }
        case 'graph_explain': {
          const runE = graphifyExplain(getArg(0, 'node') || getArg(0, 'symbol') || getArg(0));
          result = formatGraphifyToolResult(runE, 'graph_explain');
          break;
        }
        case 'ocr_page': {
          const payload = parseOcrToolPayload(
            getArg(0, 'input') || getArg(0, 'imagePath') || getArg(0),
            'page',
          );
          const runOcrPage = await ocrPageRequest({
            imagePath: payload.imagePath || payload.path,
            imageUrl: payload.imageUrl,
            mode: payload.mode,
            prompt: payload.prompt,
          });
          result = formatOcrToolResult(runOcrPage, 'ocr_page');
          break;
        }
        case 'ocr_document': {
          const payload = parseOcrToolPayload(
            getArg(0, 'input') || getArg(0, 'pdfPath') || getArg(0),
            'document',
          );
          const runOcrDoc = await ocrDocumentRequest({
            pdfPath: payload.pdfPath || payload.path,
            imageFiles: payload.imageFiles,
            maxPages: payload.maxPages,
            mode: payload.mode,
            prompt: payload.prompt,
          });
          result = formatOcrToolResult(runOcrDoc, 'ocr_document');
          break;
        }

        default:
          result = `ERREUR : Outil inconnu [${toolName}].`;
      }

    return result;
  }

  parseArgs(raw) {
    // Parser simple mais sécurisé pour les arguments séparés par virgules
    const args = [];
    let current = '';
    let inString = false;
    let quoteChar = '';

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if ((char === '"' || char === "'" || char === "`") && raw[i - 1] !== '\\') {
        if (!inString) { inString = true; quoteChar = char; }
        else if (char === quoteChar) { inString = false; }
        else { current += char; }
      } else if (char === ',' && !inString) {
        args.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    args.push(current.trim());
    return args.map(a => a.replace(/^["'`]|["'`]$/g, '').replace(/\\"/g, '"').replace(/\\n/g, '\n'));
  }
}

export default new ToolExecutor();

