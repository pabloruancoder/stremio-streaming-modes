// Gera o addon como arquivos estáticos (para hospedar no GitHub Pages, sem servidor).
// O Stremio do celular/TV só precisa do manifest e dos catálogos. Cada fileira traz TODOS os títulos
// disponíveis, em arquivos de 100: catalog/<tipo>/<id>.json e catalog/<tipo>/<id>/skip=100.json,
// skip=200.json... (é o endereço que o Stremio pede quando você rola até o fim da fileira).
//
// "Adicionados recentemente": a cada execução o catálogo completo é comparado com o da execução
// anterior (state/<streaming>.json, lido da própria cópia publicada). O que não existia entra na fileira.
//
// Uso: node --env-file-if-exists=.env scripts/build-static.mjs [pasta de saída]
import fs from 'node:fs';
import path from 'node:path';
import { config, hasTmdb } from '../src/config.js';
import { manifestCatalogs, fullCatalog, catalogKind } from '../src/catalogs.js';
import { upcoming } from '../src/news.js';
import { PROVIDERS, isAnyProvider } from '../src/providers.js';

const out = path.resolve(process.argv[2] || 'dist');
const CHUNK = 100; // títulos por arquivo
const RECENT_DAYS = 30; // quanto tempo um título fica em "adicionados recentemente"
const FORGET_DAYS = 60; // título que sumiu do catálogo há mais que isso é esquecido (se voltar, é novidade)
const DAY = 86400_000;
const now = Date.now();

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
// Cada fileira vai para a raiz (usada pelo plugin e pelo manifest principal) e para a pasta do
// streaming (<streaming>/catalog/...), que é a base do addon separado de cada um (<streaming>/manifest.json).
const writeCatalog = (type, id, metas) => {
  for (const base of ['', `${id.split('.')[0]}/`]) {
    write(`${base}catalog/${type}/${id}.json`, { metas: metas.slice(0, CHUNK) });
    for (let skip = CHUNK; skip < metas.length; skip += CHUNK) {
      write(`${base}catalog/${type}/${id}/skip=${skip}.json`, { metas: metas.slice(skip, skip + CHUNK) });
    }
  }
};

// Histórico da execução anterior: a cópia publicada no GitHub Pages ou, se ela não responder, a cópia
// local (addon/data, guardada pelo cache do Actions); vale a mais recente. 404 nos dois = primeira vez.
// Se o Pages falhar e não houver cópia local, o build para: sem histórico, tudo pareceria novidade.
const localStateFile = (provider) => path.join(config.dataDir, `state-${provider.key}.json`);
async function previousState(provider) {
  let local = null;
  try { local = JSON.parse(fs.readFileSync(localStateFile(provider), 'utf8')); } catch { /* sem cópia local */ }
  const url = `${config.pagesUrl}/state/${provider.key}.json`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return local;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const remote = await res.json();
      return (local?.updated || 0) > (remote.updated || 0) ? local : remote;
    } catch (err) {
      if (attempt >= 6) {
        if (local) { console.warn(`  ${url}: ${err.message}; usando a cópia local do histórico.`); return local; }
        throw new Error(`não consegui ler ${url}: ${err.message}`);
      }
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
}

const catalogs = manifestCatalogs();
const results = new Map(); // id -> metas
let total = 0;
const started = Date.now();
for (const c of catalogs) {
  if (catalogKind(c.id) === 'recent') continue;
  const t = Date.now();
  const metas = await fullCatalog(c.id).catch((err) => {
    console.warn(`  ${c.id}: ${err.message}`);
    return [];
  });
  results.set(c.id, metas);
  writeCatalog(c.type, c.id, metas);
  total += metas.length;
  console.log(`${c.id.padEnd(32)} ${String(metas.length).padStart(5)} títulos  (${((Date.now() - t) / 1000).toFixed(0)} s)`);
}

// Adicionados recentemente, por streaming.
for (const p of Object.values(PROVIDERS)) {
  const all = {
    movie: results.get(`${p.key}.all-movies`) || [],
    series: results.get(`${p.key}.all-series`) || [],
  };
  if (!all.movie.length && !all.series.length) continue;
  // Sem filtro de streaming ("todos"), não existe "chegou ao streaming": a fileira mostra os lançamentos.
  if (isAnyProvider(p)) {
    for (const type of ['movie', 'series']) {
      const id = `${p.key}.recent-${type === 'movie' ? 'movies' : 'series'}`;
      if (!catalogs.some((c) => c.id === id)) continue;
      const fresh = results.get(`${p.key}.new-${type === 'movie' ? 'movies' : 'series'}`) || [];
      writeCatalog(type, id, fresh);
      total += fresh.length;
      console.log(`${id.padEnd(32)} ${String(fresh.length).padStart(5)} títulos (lançamentos)`);
    }
    continue;
  }
  const prev = await previousState(p);
  const items = {};
  for (const type of ['movie', 'series']) {
    for (const m of all[type]) {
      const key = `${type}:${m.id}`;
      const old = prev?.items?.[key];
      // f: quando apareceu pela primeira vez (0 = já estava lá quando o histórico começou)
      items[key] = { f: old ? old.f : prev ? now : 0, l: now };
    }
  }
  let kept = 0;
  for (const [key, old] of Object.entries(prev?.items || {})) {
    if (!items[key] && now - old.l < FORGET_DAYS * DAY) { items[key] = old; kept++; }
  }
  const state = { v: 1, since: prev?.since || now, updated: now, items };
  write(`state/${p.key}.json`, state);
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(localStateFile(p), JSON.stringify(state));

  for (const type of ['movie', 'series']) {
    const id = `${p.key}.recent-${type === 'movie' ? 'movies' : 'series'}`;
    if (!catalogs.some((c) => c.id === id)) continue;
    // Mais novo primeiro; os que chegaram juntos seguem a popularidade (ordem do catálogo completo).
    const recent = all[type]
      .map((m, i) => ({ m, i, f: items[`${type}:${m.id}`].f }))
      .filter((x) => x.f && now - x.f < RECENT_DAYS * DAY)
      .sort((a, b) => b.f - a.f || a.i - b.i)
      .map((x) => x.m);
    // Enquanto o histórico ainda é curto (primeiras execuções), completa com os lançamentos.
    if (recent.length < 20) {
      const seen = new Set(recent.map((m) => m.id));
      const fresh = results.get(`${p.key}.new-${type === 'movie' ? 'movies' : 'series'}`) || [];
      recent.push(...fresh.filter((m) => !seen.has(m.id)));
    }
    writeCatalog(type, id, recent);
    total += recent.length;
    console.log(`${id.padEnd(32)} ${String(recent.length).padStart(5)} títulos`);
  }
  const fresh = Object.values(items).filter((x) => x.f === now).length;
  console.log(`  ${p.label}: ${all.movie.length} filmes e ${all.series.length} séries no catálogo; ` +
    `${prev ? `${fresh} novos desde a última execução` : 'primeira execução (histórico começa agora)'}` +
    `${kept ? `; ${kept} sumiram há pouco e continuam no histórico` : ''}.`);
}

// Estreias (fileira "Em breve" do plugin quando o addon do PC está desligado).
for (const p of Object.values(PROVIDERS)) {
  const items = await upcoming(p).catch(() => []);
  write(`sm/upcoming/${p.key}.json`, { items });
  console.log(`em breve (${p.key})`.padEnd(32), String(items.length).padStart(5), 'títulos');
}

// Um addon por streaming (<streaming>/manifest.json). O da raiz continua sendo o da Netflix,
// que é o endereço já instalado no celular e na TV.
const updated = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const manifestFor = (p, id) => ({
  id,
  version: '0.4.0',
  name: p.key === 'netflix' ? 'Streaming Modes' : `Streaming Modes: ${p.label}`,
  description: `Catálogo completo da ${p.label} Brasil: ${p.hasOfficialTop10 ? 'Top 10 oficial, ' : ''}adicionados recentemente, lançamentos, em alta, gêneros e todos os filmes e séries. Atualizado em ${updated}.`,
  resources: ['catalog'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: catalogs.filter((c) => c.id.startsWith(`${p.key}.`)).map(({ id, type, name, extra }) => ({ id, type, name, extra })),
  behaviorHints: { configurable: false },
});
for (const p of Object.values(PROVIDERS)) write(`${p.key}/manifest.json`, manifestFor(p, `community.streaming-modes.${p.key}`));
write('manifest.json', manifestFor(PROVIDERS.netflix, 'community.streaming-modes'));
// Lista com as fileiras de todos os streamings (o plugin usa quando o addon do PC está desligado).
write('sm/catalogs.json', { catalogs: catalogs.map(({ id, type, name, extra }) => ({ id, type, name, extra })) });
write('.nojekyll', '');
fs.writeFileSync(path.join(out, 'index.html'),
  '<!doctype html><meta charset="utf-8"><title>Streaming Modes</title><p>Addon do Stremio. Instale copiando o endereço desta página seguido de <code>manifest.json</code>.</p>');

console.log(`\nPronto: ${catalogs.length} fileiras, ${total} títulos em ${out} (${((Date.now() - started) / 60000).toFixed(1)} min)`);
process.exit(0);
