import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPaths = [path.join(root, 'server/.env'), path.join(root, '.env')];

envPaths.forEach((envPath) => {
  if (!fs.existsSync(envPath)) return;
  try {
    const buffer = fs.readFileSync(envPath);
    const cleanContent = buffer.filter((byte) => byte !== 0).toString('utf8');
    const lines = cleanContent.split('\n').map((line) => {
      if (line.includes('J W T _ S E C R E T') || line.includes('JWT_SECRET')) {
        if (line.includes('J W T _ S E C R E T')) {
          return line.replace(/\s+/g, '');
        }
      }
      return line;
    });
    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
    console.log(`✅ Fichier ${envPath} nettoyé.`);
  } catch (err) {
    console.error(`❌ Erreur sur ${envPath}:`, err.message);
  }
});
