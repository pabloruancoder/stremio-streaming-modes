// Gera o addon como arquivos estáticos (para hospedar no GitHub Pages, sem servidor).
// O Stremio do celular/TV só precisa do manifest e dos catálogos; cada fileira vira um arquivo JSON
// com até ~100 títulos (as páginas seguintes são juntadas, já que arquivo fixo não pagina).
//
// Uso: node --env-file-if-exists=.env scripts/build-static.mjs [pasta de saída]
import fs from 'node:fs';
import path from 'node:path';
import { hasTmdb } from '../src/config.js';
import { manifestCatalogs, catalogHandler } from '../src/catalogs.js';

const out = path.resolve(process.argv[2] || 'dist');
const PAGES = 5; // páginas de 20 juntadas por fileira

if (!hasTmdb()) {
  console.error('Faltou a chave do TMDB (TMDB_API_KEY ou TMDB_READ_TOKEN).');
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const write = (rel, data) => {
  const file = path.join(out, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
};

const catalogs = manifestCatalogs();
let total = 0;
for (const c of catalogs) {
  const seen = new Set();
  const metas = [];
  for (let page = 0; page < PAGES; page++) {
    const { metas: batch = [] } = await catalogHandler(c.type, c.id, page ? { skip: String(page * 20) } : {}).catch((err) => {
      console.warn(`  ${c.id} página ${page + 1}: ${err.message}`);
      return { metas: [] };
    });
    const fresh = batch.filter((m) => !seen.has(m.id) && seen.add(m.id));
    metas.push(...fresh);
    if (!fresh.length) break; // fileira acabou (Top 10, lançamentos...)
  }
  write(`catalog/${c.type}/${c.id}.json`, { metas });
  total += metas.length;
  console.log(`${c.id.padEnd(32)} ${String(metas.length).padStart(3)} títulos`);
}

// Manifest sem paginação (arquivo fixo devolve tudo de uma vez).
write('manifest.json', {
  id: 'community.streaming-modes',
  version: '0.2.0',
  name: 'Streaming Modes',
  description: `Fileiras da Netflix Brasil: Top 10 oficial, lançamentos, em alta e gêneros. Atualizado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
  resources: ['catalog'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: catalogs.map(({ id, type, name }) => ({ id, type, name })),
  behaviorHints: { configurable: false },
});
write('.nojekyll', '');
fs.writeFileSync(path.join(out, 'index.html'),
  '<!doctype html><meta charset="utf-8"><title>Streaming Modes</title><p>Addon do Stremio. Instale copiando o endereço desta página seguido de <code>manifest.json</code>.</p>');

console.log(`\nPronto: ${catalogs.length} fileiras, ${total} títulos em ${out}`);
process.exit(0);
