/* server/src/forge/utils/projectScanner.js */
import fs from 'fs/promises';
import path from 'path';

export async function scanProjectDirectory(projectPath, rootPath = null) {
  const baseRoot = rootPath || projectPath;
  try {
    const items = await fs.readdir(projectPath, { withFileTypes: true });
    
    const tree = [];
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue;
      
      const fullPath = path.join(projectPath, item.name);
      const relativePath = path.relative(baseRoot, fullPath);
      const stats = await fs.stat(fullPath);
      
      if (item.isDirectory()) {
        const children = await scanProjectDirectory(fullPath, baseRoot);
        tree.push({
          name: item.name,
          path: relativePath,
          type: 'directory',
          children: children
        });
      } else {
        tree.push({
          name: item.name,
          path: relativePath,
          type: 'file',
          size: stats.size,
          mtime: stats.mtime
        });
      }
    }
    
    return tree.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function loadQAAudit(projectPath) {
  const auditPath = path.join(projectPath, 'qa_audit.json');
  try {
    const content = await fs.readFile(auditPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
