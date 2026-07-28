/* server/tests/test_async_forge_service.js */
import AsyncForgeService from '../src/services/AsyncForgeService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 [Test-AsyncForge] Démarrage des validations du service...');

  const task = 'Validation automatisée du service Async Forge v0.2';
  const repo = path.resolve(__dirname, '..'); // dossier server/
  const testCommand = 'npm run test:completeness';

  // 1. Lancement du job
  const jobId = AsyncForgeService.startJob(task, repo, testCommand, 'mock');
  console.log(`🟢 Job initié avec succès. ID : ${jobId}`);

  // 2. Boucle de surveillance active (Polling)
  let attempts = 0;
  const maxAttempts = 180; // 180 secondes pour absorber l'inférence Ollama local
  
  const poll = () => new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      attempts++;
      const job = AsyncForgeService.getJob(jobId);
      
      if (!job) {
        clearInterval(interval);
        return reject(new Error('Le job a disparu de la mémoire !'));
      }

      console.log(`⏱️ [Seconde ${attempts}] Statut : ${job.status} | Progression : ${job.progress}%`);

      if (job.status === 'SUCCESS' || job.status === 'FAILED' || job.status === 'TIMEOUT') {
        clearInterval(interval);
        resolve(job);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(new Error('Timeout de validation dépassé (30s)'));
      }
    }, 1000);
  });

  try {
    const finalJob = await poll();
    
    console.log('\n=============================================');
    console.log('📊 RÉSULTATS DU RUN DE TEST :');
    console.log(`- Statut Final         : ${finalJob.status}`);
    console.log(`- Durée (ms)           : ${finalJob.duration_ms} ms`);
    console.log(`- Fichiers impactés    : ${finalJob.files_changed_count}`);
    console.log(`- Diff Stats           : ${finalJob.diff_stat}`);
    console.log(`- Docker Image         : ${finalJob.image_name}`);
    console.log(`- Stratégie Sandbox    : ${finalJob.sandbox_strategy}`);
    console.log(`- OS Hôte              : ${finalJob.host_fingerprint?.os}`);
    console.log(`- Version Docker Hôte  : ${finalJob.host_fingerprint?.docker_version}`);
    console.log('=============================================\n');

    // 3. Assertions fondamentales
    if (finalJob.status !== 'SUCCESS' && finalJob.status !== 'FAILED') {
      throw new Error(`Le statut final attendu était SUCCESS ou FAILED, mais a retourné : ${finalJob.status}`);
    }

    if (typeof finalJob.files_changed_count !== 'number') {
      throw new Error(`Le nombre de fichiers modifiés attendu doit être un nombre, obtenu : ${finalJob.files_changed_count}`);
    }

    if (!finalJob.report.includes('Rapport d\'Audit Async Forge')) {
      throw new Error('Le rapport Markdown généré est invalide ou tronqué.');
    }

    // 4. Validation de la persistance JSON
    const history = AsyncForgeService.listJobs();
    const persisted = history.find(j => j.id === jobId);
    
    if (!persisted) {
      throw new Error('Le job n\'a pas été persisté dans l\'historique !');
    }
    
    console.log('✅ [Test-AsyncForge] Toutes les assertions du service backend sont validées avec succès ! 100% de réussite.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ [Test-AsyncForge] Échec de la suite de validation :', error.message);
    const job = AsyncForgeService.getJob(jobId);
    if (job) {
      console.log('\n--- DEBUG RUN LOGS ---');
      console.log('--- STDOUT ---');
      console.log(job.stdout || '[Aucun]');
      console.log('--- STDERR ---');
      console.log(job.stderr || '[Aucun]');
      console.log('----------------------\n');
    }
    process.exit(1);
  }
}

runTests();
