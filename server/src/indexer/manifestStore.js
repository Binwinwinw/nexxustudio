
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class ManifestStore {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.manifest = {};
  }

  async load() {
    try {
      const data = await fs.readFile(this.storagePath, 'utf8');
      this.manifest = JSON.parse(data);
    } catch (e) {
      this.manifest = {};
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
    await fs.writeFile(this.storagePath, JSON.stringify(this.manifest, null, 2));
  }

  computeHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  shouldReindex(filePath, currentMtime, currentHash) {
    const entry = this.manifest[filePath];
    if (!entry) return true;
    return entry.mtime !== currentMtime || entry.hash !== currentHash;
  }

  updateEntry(filePath, mtime, hash, status = 'indexed') {
    this.manifest[filePath] = {
      mtime,
      hash,
      status,
      lastIndexed: new Date().toISOString()
    };
  }
}

export default ManifestStore;
