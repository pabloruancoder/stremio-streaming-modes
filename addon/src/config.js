import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT) || 7100,
  region: (process.env.REGION || 'BR').toUpperCase(),
  language: process.env.LANGUAGE || 'pt-BR',
  tmdbApiKey: process.env.TMDB_API_KEY?.trim() || '',
  tmdbReadToken: process.env.TMDB_READ_TOKEN?.trim() || '',
  cardStyle: process.env.CARD_STYLE === 'poster' ? 'poster' : 'landscape',
  dataDir: path.join(root, 'data'),
  // Cópia publicada no GitHub Pages: guarda o histórico de "adicionados recentemente".
  pagesUrl: (process.env.PAGES_URL || 'https://pabloruancoder.github.io/stremio-streaming-modes').replace(/\/+$/, ''),
};

export const hasTmdb = () => Boolean(config.tmdbApiKey || config.tmdbReadToken);
