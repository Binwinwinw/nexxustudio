/* server/src/services/AsyncForgeService.js */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AsyncForgeService
 * Orchestre l'évaluation et l'exécution asynchrone des tâches dans des sandbox éphémères.
 */
class AsyncForgeService {
  constructor() {
    this.jobsFile = path.resolve(__dirname, '../../data/forge_jobs.json');
    this.outputsDir = path.resolve(__dirname, '../../../tools/async_forge/outputs');
    this.activeJobs = new Map(); // jobId -> Job Object
    this.loadJobsHistory();
  }

  /**
   * Charge l'historique des jobs depuis le fichier JSON souverain.
   */
  loadJobsHistory() {
    try {
      if (fs.existsSync(this.jobsFile)) {
        this.jobsHistory = fs.readJsonSync(this.jobsFile);
      } else {
        this.jobsHistory = [];
        fs.ensureDirSync(path.dirname(this.jobsFile));
        fs.writeJsonSync(this.jobsFile, []);
      }
    } catch (error) {
      console.error('❌ [AsyncForgeService] Impossible de charger l\'historique des jobs:', error);
      this.jobsHistory = [];
    }
  }

  /**
   * Enregistre l'historique des jobs dans le fichier JSON souverain.
   */
  saveJobsHistory() {
    try {
      fs.writeJsonSync(this.jobsFile, this.jobsHistory, { spaces: 2 });
    } catch (error) {
      console.error('❌ [AsyncForgeService] Impossible d\'enregistrer l\'historique des jobs:', error);
    }
  }

  /**
   * Lance une tâche Async Forge en arrière-plan.
   */
  startJob(task, repo, testCommand, model, critiqueModel) {
    const jobId = `job_${Math.floor(Date.now() / 1000)}_${Math.random().toString(16).substring(2, 8)}`;
    
    const absoluteRepoPath = path.resolve(repo);
    const pythonScript = path.resolve(__dirname, '../../../tools/async_forge/run_async_forge.py');

    const job = {
      id: jobId,
      task,
      repo: absoluteRepoPath,
      test_command: testCommand,
      status: 'PENDING',
      progress: 0,
      stdout: '',
      stderr: '',
      start_time: new Date().toISOString(),
      end_time: null,
      duration_ms: 0,
      files_changed_count: 0,
      diff_stat: '0, 0',
      sandbox_strategy: 'snapshot copy',
      image_name: 'node:20-alpine',
      exit_code: null,
      host_fingerprint: null,
      diff: '',
      report: ''
    };

    this.activeJobs.set(jobId, job);
    console.log(`⚡ [AsyncForge] Lancement du Job ${jobId} (Model: ${model || 'default'}) pour la tâche: "${task}"`);

    const args = [
      pythonScript,
      '--task', task,
      '--repo', absoluteRepoPath,
      '--test-command', testCommand,
      '--output-dir', this.outputsDir,
      '--job-id', jobId
    ];

    if (model === 'mock' || model === 'test') {
      args.push('--mock');
    } else {
      if (model) {
        args.push('--model', model);
      }
      if (critiqueModel) {
        args.push('--critique-model', critiqueModel);
      }
    }

    job.status = 'RUNNING';
    job.progress = 5;

    const child = spawn('python', args, {
      cwd: path.resolve(__dirname, '../../..'),
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    job.process = child;

    child.stdout.on('data', (data) => {
      const text = data.toString();
      job.stdout += text;
      
      // Heuristiques de progression v0.3 basées sur les phases d'Async Forge
      if (text.includes('[Async Forge][Phase 1]')) {
        job.progress = 20;
      } else if (text.includes('[Async Forge][Phase 2]')) {
        job.progress = 40;
      } else if (text.includes('[Async Forge][Phase 3]')) {
        job.progress = 60;
      } else if (text.includes('[Async Forge][Phase 4]')) {
        job.progress = 80;
      } else if (text.includes('[Async Forge][Phase 5]')) {
        job.progress = 95;
      } else if (text.includes('Montage read-only')) {
        job.progress = 15;
      } else if (text.includes('Lancement du conteneur')) {
        job.progress = 50;
      } else if (text.includes('Rapport d\'audit généré')) {
        job.progress = 98;
      }
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      job.stderr += text;
    });

    child.on('close', async (code) => {
      console.log(`⚡ [AsyncForge] Fin du processus pour le Job ${jobId} avec le code : ${code}`);
      job.end_time = new Date().toISOString();
      job.duration_ms = Date.now() - new Date(job.start_time).getTime();
      job.progress = 100;
      job.exit_code = code;

      try {
        const metadataFile = path.join(this.outputsDir, `metadata_${jobId}.json`);
        const reportFile = path.join(this.outputsDir, `report_${jobId}.md`);

        if (fs.existsSync(metadataFile)) {
          const meta = await fs.readJson(metadataFile);
          job.status = meta.status;
          job.image_name = meta.image_name;
          job.sandbox_strategy = meta.sandbox_strategy;
          job.files_changed_count = meta.files_changed_count;
          job.diff_stat = meta.diff_stat;
          job.host_fingerprint = meta.host_fingerprint;
          job.duration_ms = meta.duration_ms;
          job.start_time = meta.start_time;
          job.end_time = meta.end_time;
        } else {
          job.status = code === 0 ? 'SUCCESS' : 'FAILED';
        }

        if (fs.existsSync(reportFile)) {
          job.report = await fs.readFile(reportFile, 'utf8');
          const diffMatch = job.report.match(/## 🛠️ Différence Git \(Mutations de Code\)\s*```diff\s*([\s\S]*?)```/);
          if (diffMatch) {
            job.diff = diffMatch[1].trim();
          }
        }
      } catch (err) {
        console.error(`❌ [AsyncForge] Erreur lors du chargement des fichiers de job ${jobId}:`, err);
        job.status = code === 0 ? 'SUCCESS' : 'FAILED';
      }

      // Nettoyer la référence du processus et retirer des jobs actifs
      delete job.process;
      this.activeJobs.delete(jobId);

      // Ajouter en tête d'historique et sauvegarder
      this.jobsHistory.unshift(job);
      this.saveJobsHistory();
    });

    return jobId;
  }

  /**
   * Récupère un job par son identifiant.
   */
  getJob(jobId) {
    if (this.activeJobs.has(jobId)) {
      const active = this.activeJobs.get(jobId);
      const { process, ...cleanJob } = active;
      return cleanJob;
    }
    const found = this.jobsHistory.find(j => j.id === jobId);
    return found || null;
  }

  /**
   * Liste l'ensemble des jobs actifs et passés.
   */
  listJobs() {
    const activeClean = Array.from(this.activeJobs.values()).map(active => {
      const { process, ...cleanJob } = active;
      return cleanJob;
    });
    return [...activeClean, ...this.jobsHistory];
  }

  /**
   * Annule et interrompt de force un job en cours d'exécution.
   */
  async cancelJob(jobId) {
    console.log(`⚠️ [AsyncForge] Demande d'annulation du Job ${jobId}`);
    if (this.activeJobs.has(jobId)) {
      const active = this.activeJobs.get(jobId);
      active.status = 'FAILED';
      active.progress = 100;
      active.end_time = new Date().toISOString();

      // 1. Tuer le processus Python
      if (active.process) {
        try {
          active.process.kill('SIGTERM');
        } catch (e) {
          console.error(`❌ [AsyncForge] Échec de l'arrêt du processus Python ${jobId}:`, e);
        }
      }

      // 2. Tuer de force le conteneur Docker éphémère
      const containerSuffix = jobId.split('_').at(-1);
      const containerName = `async_forge_run_${containerSuffix}`;
      console.log(`🐳 [AsyncForge] Nettoyage forcé du conteneur : ${containerName}`);
      
      const dockerKill = spawn('docker', ['kill', containerName]);
      dockerKill.on('close', () => {
        spawn('docker', ['rm', '-f', containerName]);
      });

      delete active.process;
      this.activeJobs.delete(jobId);
      this.jobsHistory.unshift(active);
      this.saveJobsHistory();
      return true;
    }
    return false;
  }
}

export default new AsyncForgeService();
