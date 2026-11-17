// Copia o plugin para a pasta de plugins do Stremio Enhanced.
// Uso: node scripts/install-plugin.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '..', 'plugin', 'streaming-modes.plugin.js');

const base =
  process.platform === 'win32'
    ? process.env.APPDATA
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.config');
const dest = path.join(base, 'stremio-enhanced', 'plugins');

fs.mkdirSync(dest, { recursive: true });
fs.copyFileSync(src, path.join(dest, path.basename(src)));
console.log(`Plugin copiado para ${dest}`);
console.log('Abra o Stremio Enhanced > Settings > Plugins, ative "Streaming Modes" e recarregue (Ctrl+R).');
