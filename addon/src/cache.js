import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

// Cache em memória com TTL. Guarda a Promise, então requisições simultâneas
// para a mesma chave compartilham uma única busca.
const memory = new Map();

export function cached(key, ttlMs, producer) {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = Promise.resolve().then(producer);
  memory.set(key, { value, expires: Date.now() + ttlMs });
  value.catch(() => memory.delete(key)); // não guarda falhas
  return value;
}

// Mapa persistente em disco (ex.: TMDB id -> IMDb id), que nunca expira.
export function persistentMap(name) {
  const file = path.join(config.dataDir, `${name}.json`);
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    /* primeiro uso */
  }
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data));
    }, 2000);
  };
  return {
    has: (k) => Object.prototype.hasOwnProperty.call(data, k),
    get: (k) => data[k],
    set: (k, v) => {
      data[k] = v;
      save();
    },
  };
}

// Executa fn sobre os itens com no máximo `limit` em paralelo, mantendo a ordem.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
