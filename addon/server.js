import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, hasTmdb } from './src/config.js';
import { manifestCatalogs, catalogHandler } from './src/catalogs.js';
import { fullDetails, seasonEpisodes, similarOnProvider, latestEpisode } from './src/tmdb.js';
import { mapLimit } from './src/cache.js';
import { PROVIDERS } from './src/providers.js';
import { searchOnProvider, searchMore } from './src/search.js';
import { upcoming } from './src/news.js';
import { skipTimes, nextEpisode } from './src/player.js';
import { forYou } from './src/foryou.js';
import * as fontes from './src/fontes.js';

const manifest = () => ({
  id: 'community.streaming-modes',
  version: '0.1.0',
  name: 'Streaming Modes',
  description:
    'Fileiras por streaming (Netflix primeiro): Top 10 oficial do país, só na Netflix, em alta, lançamentos e gêneros. Use com o plugin Streaming Modes para o visual completo.',
  resources: ['catalog'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: manifestCatalogs(),
  behaviorHints: { configurable: false },
});

function send(res, status, body, maxAge = 0) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-cache',
  });
  res.end(JSON.stringify(body));
}

// Vinhetas locais: addon/intro/<streaming>.mp4 ou .webm (opcional).
const INTRO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'intro');
function introFile(key) {
  for (const ext of ['mp4', 'webm']) {
    const f = path.join(INTRO_DIR, `${key}.${ext}`);
    if (fs.existsSync(f)) return { file: f, type: `video/${ext}` };
  }
  return null;
}

// Envia o vídeo com suporte a Range (o player do navegador pede pedaços do arquivo).
function sendVideo(req, res, { file, type }) {
  const size = fs.statSync(file).size;
  const headers = { 'content-type': type, 'accept-ranges': 'bytes', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=86400' };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (!m) {
    res.writeHead(200, { ...headers, 'content-length': size });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file).pipe(res);
  }
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  if (start >= size || start > end) {
    res.writeHead(416, { ...headers, 'content-range': `bytes */${size}` });
    return res.end();
  }
  res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file, { start, end }).pipe(res);
}

// ---------- Minhas fontes (só para acessos do próprio PC) ----------
const FONTES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fontes');
const isLoopback = (req) => /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(req.socket.remoteAddress || '');
// A API de edição só aceita a própria página (127.0.0.1/localhost) e o Stremio (plugin); outros sites ficam de fora.
const fontesOriginOk = (origin) => !origin || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin) ||
  /^https:\/\/([a-z0-9-]+\.)*stremio\.com$/.test(origin) || /^(file:\/\/|app:\/\/|null$)/.test(origin);
async function readBody(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 200_000) throw new Error('corpo grande demais'); }
  return body ? JSON.parse(body) : {};
}
async function handleFontes(req, res, pathname) {
  const base = `http://${req.headers.host || `127.0.0.1:${config.port}`}`;
  let x;
  if (pathname === '/fontes/manifest.json') return send(res, 200, fontes.fontesManifest(base));
  if ((x = pathname.match(/^\/fontes\/stream\/(movie|series)\/([^/]+)\.json$/))) {
    return send(res, 200, { streams: await fontes.streamsFor(x[1], decodeURIComponent(x[2])), cacheMaxAge: 0 });
  }
  if (pathname === '/fontes' || pathname === '/fontes/' || pathname === '/fontes/configure' || pathname === '/fontes/logo.svg') {
    const file = pathname.endsWith('.svg') ? 'logo.svg' : 'index.html';
    res.writeHead(200, { 'content-type': file.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8', 'cache-control': 'no-cache',
      'access-control-allow-origin': '*' });
    return res.end(fs.readFileSync(path.join(FONTES_DIR, file)));
  }
  if (!pathname.startsWith('/fontes/api/')) return send(res, 404, { error: 'not found' });
  const origin = req.headers.origin;
  if (!fontesOriginOk(origin)) return send(res, 403, { error: 'origem não permitida' });
  const reply = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
      'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE',
      'access-control-allow-private-network': 'true' });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return reply(204, {});
  try {
    if (pathname === '/fontes/api/list' && req.method === 'GET') return reply(200, fontes.listAll());
    if (pathname === '/fontes/api/sources' && req.method === 'POST') return reply(200, fontes.addSource(await readBody(req)));
    if ((x = pathname.match(/^\/fontes\/api\/sources\/([a-f0-9]+)$/))) {
      if (req.method === 'PATCH') return reply(200, fontes.updateSource(x[1], await readBody(req)));
      if (req.method === 'DELETE') { fontes.removeSource(x[1]); return reply(200, { ok: true }); }
    }
    if (pathname === '/fontes/api/addons' && req.method === 'POST') return reply(200, await fontes.addAddon((await readBody(req)).url));
    if ((x = pathname.match(/^\/fontes\/api\/addons\/([a-f0-9]+)$/))) {
      if (req.method === 'PATCH') return reply(200, fontes.updateAddon(x[1], await readBody(req)));
      if (req.method === 'DELETE') { fontes.removeAddon(x[1]); return reply(200, { ok: true }); }
    }
    // Testar: o que o Stremio vai receber para um filme/episódio, com avisos dos pacotes e addons que falharem.
    if ((x = pathname.match(/^\/fontes\/api\/test\/(movie|series)\/([^/]+)$/))) {
      const notes = [];
      const streams = await fontes.streamsFor(x[1], decodeURIComponent(x[2]), notes);
      return reply(200, { streams, notes });
    }
    return reply(404, { error: 'not found' });
  } catch (err) {
    return reply(400, { error: err.message });
  }
}

const CATALOG_RE = /^\/catalog\/(movie|series)\/([^/]+?)(?:\/([^/]+))?\.json$/;

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/fontes' || pathname.startsWith('/fontes/')) {
      if (!isLoopback(req)) return send(res, 404, { error: 'not found' });
      if (req.method === 'OPTIONS' && !pathname.startsWith('/fontes/api/')) return send(res, 204, {});
      return await handleFontes(req, res, pathname);
    }
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (pathname === '/manifest.json') return send(res, 200, manifest());
    if (pathname === '/') {
      // Não serve o manifest aqui: o Stremio exige que a URL instalada termine em /manifest.json.
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(
        `<meta charset="utf-8"><p>Streaming Modes está rodando. Instale no Stremio com:</p>` +
          `<pre>${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || `127.0.0.1:${config.port}`}/manifest.json</pre>`,
      );
    }
    if (pathname === '/health') return send(res, 200, { ok: true, tmdb: hasTmdb(), region: config.region });

    // Endpoints extras usados só pelo plugin (não fazem parte do protocolo do Stremio).
    let x;
    if ((x = pathname.match(/^\/sm\/intro\/([a-z]+)$/))) {
      const intro = introFile(x[1]);
      if (!intro) return send(res, 404, { error: 'sem vinheta local' });
      return sendVideo(req, res, intro);
    }
    // Novos episódios das séries que a pessoa acompanha: ?ids=tt1,tt2 (até 60).
    if (pathname === '/sm/new-episodes.json') {
      if (!hasTmdb()) return send(res, 200, { episodes: [] });
      const ids = [...new Set((searchParams.get('ids') || '').split(',').filter((v) => /^tt\d+$/.test(v)))].slice(0, 60);
      const since = new Date(Date.now() - 21 * 86400_000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const list = await mapLimit(ids, 6, (id) => latestEpisode(id).catch(() => null));
      return send(res, 200, { episodes: list.filter((e) => e && e.date >= since && e.date <= today) }, 3600);
    }
    // Backup dos perfis, avaliações, listas e históricos do plugin (addon/data/plugin-backup.json).
    if (pathname === '/sm/backup.json') {
      const file = path.join(config.dataDir, 'plugin-backup.json');
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 5_000_000) break; }
        const data = JSON.parse(body);
        if (!data || typeof data !== 'object' || !data.items) return send(res, 400, { error: 'backup inválido' });
        fs.mkdirSync(config.dataDir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
        return send(res, 200, { ok: true });
      }
      try { return send(res, 200, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return send(res, 404, { error: 'sem backup' }); }
    }
    if ((x = pathname.match(/^\/sm\/details\/(movie|series)\/(tt\d+)\.json$/))) {
      if (!hasTmdb()) return send(res, 200, { details: null });
      return send(res, 200, { details: await fullDetails(x[1], x[2]) }, 6 * 3600);
    }
    if ((x = pathname.match(/^\/sm\/season\/(tt\d+)\/(\d+)\.json$/))) {
      if (!hasTmdb()) return send(res, 200, { episodes: [] });
      return send(res, 200, { episodes: await seasonEpisodes(x[1], Number(x[2])) }, 6 * 3600);
    }
    if ((x = pathname.match(/^\/sm\/similar\/([a-z]+)\/(movie|series)\/(tt\d+)\.json$/))) {
      const provider = PROVIDERS[x[1]];
      if (!provider || !hasTmdb()) return send(res, 200, { metas: [] });
      return send(res, 200, { metas: await similarOnProvider(x[2], x[3], provider.tmdbProviderId) }, 6 * 3600);
    }
    if ((x = pathname.match(/^\/sm\/foryou\/([a-z]+)\/(\d+)\.json$/))) {
      const provider = PROVIDERS[x[1]];
      if (!provider || !hasTmdb()) return send(res, 200, { done: true, metas: [] });
      // seeds=tt123:series,tt456:movie (o que a pessoa assistiu por último)
      const seeds = (searchParams.get('seeds') || '').split(',').map((s) => s.split(':'))
        .filter(([id, type]) => /^tt\d+$/.test(id || '') && (type === 'movie' || type === 'series'))
        .slice(0, 6).map(([id, type]) => ({ id, type }));
      return send(res, 200, await forYou(provider, seeds, Number(x[2])), 1800);
    }
    if ((x = pathname.match(/^\/sm\/search\/([a-z]+)\/(\d+)\.json$/))) {
      const provider = PROVIDERS[x[1]];
      if (!provider || !hasTmdb()) return send(res, 200, { metas: [], more: false });
      return send(res, 200, await searchMore(searchParams.get('q'), provider, Number(x[2])), 3600);
    }
    if ((x = pathname.match(/^\/sm\/skip\/(tt\d+)\/(\d+)\/(\d+)\.json$/))) {
      return send(res, 200, await skipTimes(x[1], Number(x[2]), Number(x[3]), searchParams.get('len')), 6 * 3600);
    }
    if ((x = pathname.match(/^\/sm\/next\/(tt\d+)\/(\d+)\/(\d+)\.json$/))) {
      return send(res, 200, { next: await nextEpisode(x[1], Number(x[2]), Number(x[3])).catch(() => null) }, 3 * 3600);
    }
    if ((x = pathname.match(/^\/sm\/upcoming\/([a-z]+)\.json$/))) {
      const provider = PROVIDERS[x[1]];
      if (!provider || !hasTmdb()) return send(res, 200, { items: [] });
      return send(res, 200, { items: await upcoming(provider) }, 3600);
    }
    if ((x = pathname.match(/^\/sm\/search\/([a-z]+)\.json$/))) {
      const provider = PROVIDERS[x[1]];
      if (!provider || !hasTmdb()) return send(res, 200, { related: [], metas: [] });
      return send(res, 200, await searchOnProvider(searchParams.get('q'), provider), 3600);
    }

    const m = pathname.match(CATALOG_RE);
    if (m) {
      const [, type, id, extraStr] = m;
      const extra = Object.fromEntries(new URLSearchParams(decodeURIComponent(extraStr || '')));
      const { cacheMaxAge, ...body } = await catalogHandler(type, decodeURIComponent(id), extra);
      return send(res, 200, body, cacheMaxAge);
    }
    send(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(`[erro] ${pathname}: ${err.message}`);
    send(res, 500, { metas: [], error: err.message });
  }
});

server.listen(config.port, () => {
  const url = `http://127.0.0.1:${config.port}/manifest.json`;
  console.log(`Streaming Modes rodando em ${url}`);
  console.log(`Região: ${config.region} · Idioma: ${config.language}`);
  if (!hasTmdb()) {
    console.warn('Sem chave do TMDB no .env: só o Top 10 oficial vai aparecer.');
  }
  console.log(`Para instalar, cole no Stremio (Addons > campo de busca): ${url}`);
  console.log(`Minhas fontes: http://127.0.0.1:${config.port}/fontes (addon: http://127.0.0.1:${config.port}/fontes/manifest.json)`);

  // Pré-carrega o Top 10 (o arquivo da Netflix tem ~33 MB) para a Home não esperar.
  for (const type of ['series', 'movie']) {
    catalogHandler(type, `netflix.top10-${type === 'movie' ? 'movies' : 'series'}`, {})
      .then(({ metas }) => console.log(`Top 10 (${type}) pronto: ${metas.length} títulos`))
      .catch((err) => console.warn(`Top 10 (${type}) falhou: ${err.message}`));
  }
});
