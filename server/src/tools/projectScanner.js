import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_ROOT = path.resolve(__dirname, '../../../projects');

function scoreProject(projectPath, folderName) {
  const files = fs.readdirSync(projectPath);
  let score = 0;
  const stack = [];

  const hasPackage = files.includes('package.json');
  const hasVite = files.some(f => f.startsWith('vite.config'));
  const hasHtml = files.includes('index.html');
  const hasSrc = files.includes('src');
  const hasBuild = files.includes('dist') || files.includes('build') || files.includes('out');

  // 1. Detection de la Stack
  if (hasPackage) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.react) stack.push('React');
      if (deps.typescript || deps.ts) stack.push('TS');
      if (deps.tailwindcss) stack.push('Tailwind');
      if (deps.vite) stack.push('Vite');
      if (deps.express || deps.fastify || deps.koa) stack.push('Backend');
      if (deps.prisma || deps.mongoose || deps.sequelize) stack.push('DB-ORM');
    } catch (e) {}
  }

  const isBackend = stack.includes('Backend');

  // 2. Base Score (3/10)
  if (isBackend) {
    if (hasPackage && hasSrc) score = 3;
  } else {
    if (hasPackage && hasVite && hasHtml) score = 3;
  }

  // 3. Functional Score (5/10)
  if (hasSrc) {
    const srcPath = path.join(projectPath, 'src');
    const srcFiles = fs.readdirSync(srcPath);
    if (isBackend) {
      if (srcFiles.includes('index.js') || srcFiles.includes('server.js') || srcFiles.includes('app.ts')) score = 5;
    } else {
      if (srcFiles.includes('App.jsx') || srcFiles.includes('main.jsx') || srcFiles.includes('App.tsx')) score = 5;
    }
  }

  // 4. Build/Test Score (8/10)
  if (hasBuild || files.includes('node_modules')) {
    score = 8;
  }

  // 5. Documentation & Governance (up to 20/20)
  const docs = [
    'README.md',
    'README_PRODUCTION.md',
    'ADR-SECURITY.md',
    'ADR-BOOKFLOW-SECURITY.md',
    'RUNBOOK.md',
    'RUNBOOK_BOOKFLOW.md',
    'PRODUCTION_READINESS_SCORECARD.md',
    'heritage.json',
    'manifest.json'
  ];
  const presentDocs = files.filter(f => docs.includes(f));
  
  const parentPath = path.dirname(projectPath);
  if (parentPath.includes('projects') && parentPath !== PROJECTS_ROOT) {
    const parentFiles = fs.readdirSync(parentPath);
    const parentPresentDocs = parentFiles.filter(f => docs.includes(f));
    parentPresentDocs.forEach(d => {
      if (!presentDocs.includes(d)) presentDocs.push(d);
    });
  }

  // Chaque document rapporte 2 points, plafonné à 20 total
  if (presentDocs.length > 0) {
    score = Math.min(20, score + (presentDocs.length * 2));
  }

  return {
    name: folderName,
    score,
    stack: stack.join(', ') || 'Unknown',
    status: score < 5 ? 'Scaffold Vise' : score < 15 ? 'MVP / Dev' : 'Production-Ready',
    path: projectPath
  };
}

export async function scanProjects() {
  const folders = fs.readdirSync(PROJECTS_ROOT);
  const audit = [];

  for (const folder of folders) {
    const projectPath = path.join(PROJECTS_ROOT, folder);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    const files = fs.readdirSync(projectPath);
    
    // Check if it's a project directly
    if (files.includes('package.json') || files.includes('vite.config.js') || files.includes('vite.config.ts') || files.includes('src')) {
      audit.push(scoreProject(projectPath, folder));
    }

    // Look 1 level deeper (Nested Project)
    for (const sub of files) {
      const subPath = path.join(projectPath, sub);
      if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
        const subFiles = fs.readdirSync(subPath);
        if (subFiles.includes('package.json')) {
          audit.push(scoreProject(subPath, `${folder} / ${sub}`));
        }
      }
    }
  }

  // Deduplicate (if root project was already added)
  const uniqueAudit = [];
  const seenPaths = new Set();
  for (const item of audit) {
    if (!seenPaths.has(item.path)) {
      uniqueAudit.push(item);
      seenPaths.add(item.path);
    }
  }

  return uniqueAudit.sort((a, b) => b.score - a.score);
}

export default { scanProjects };
