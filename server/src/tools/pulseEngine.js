
import fs from 'fs-extra';
import path from 'path';

class PulseEngine {
  constructor() {
    this.root = path.resolve('..');
  }

  async scanProject(dir = 'src') {
    const results = [];
    await this._scanRecursive(path.join(this.root, dir), results);
    
    // Trier par score (le pire en premier) et limiter au Top 10
    return results.sort((a, b) => a.score - b.score).slice(0, 10);
  }

  async _scanRecursive(currentPath, results) {
    const files = await fs.readdir(currentPath);
    for (const file of files) {
      if (['node_modules', '.git', 'dist', 'build'].includes(file)) continue;
      
      const fullPath = path.join(currentPath, file);
      const stats = await fs.stat(fullPath);

      if (stats.isDirectory()) {
        await this._scanRecursive(fullPath, results);
      } else if (file.match(/\.(jsx|tsx|js|ts)$/)) {
        const scoreData = await this._calculateScore(fullPath);
        results.push({
          file: path.relative(this.root, fullPath).replace(/\\/g, '/'),
          ...scoreData
        });
      }
    }
  }

  async _calculateScore(filePath) {
    const rawContent = await fs.readFile(filePath, 'utf8');
    // Supprimer les commentaires pour éviter les faux positifs (comme les explications de refactor)
    const content = rawContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    
    let score = 50;
    const issues = [];

    // --- CRITÈRES NÉGATIFS ---
    if (content.includes('extends React.Component') || content.includes('extends Component')) {
      score -= 20;
      issues.push("Legacy: Class-based component detected.");
    }
    
    if (content.includes('style={{')) {
      score -= 15;
      issues.push("Dette: Inline CSS detected.");
    }

    if (!content.includes('GlassCard')) {
      score -= 10;
      issues.push("UI: GlassCard standard missing.");
    }

    const todoCount = (content.match(/TODO|FIXME/g) || []).length;
    if (todoCount > 0) {
      score -= (todoCount * 5);
      issues.push(`Maintenance: ${todoCount} TODO/FIXME found.`);
    }

    // --- CRITÈRES POSITIFS ---
    if (content.match(/const\s+\w+\s*=\s*\(.*\)\s*=>/)) {
      score += 20;
    }

    if (content.includes('className=')) {
      score += 10;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      issues,
      complexity: content.split('\n').length
    };
  }
}

export default new PulseEngine();
