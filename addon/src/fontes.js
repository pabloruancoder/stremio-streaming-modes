// "Minhas fontes": links que a pessoa cadastra (vídeo direto, magnet) e outros addons de stream.
// Tudo fica só no PC, em addon/data/fontes.json (a pasta data/ não vai para o GitHub).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

const FILE = path.join(config.dataDir, 'fontes.json');
const FILES_CACHE = path.join(config.dataDir, 'fontes-arquivos.json');
const STREAM_SERVER = (process.env.STREAM_SERVER || 'http://127.0.0.1:11470').replace(/\/+$/, '');
const VIDEO_EXT = /\.(mkv|mp4|avi|m4v|webm|mov|ts|m2ts|wmv|flv|mpg|mpeg)$/i;

// ---------- Armazenamento ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}
const load = () => {
  const d = readJson(FILE, {});
  return { sources: Array.isArray(d.sources) ? d.sources : [], addons: Array.isArray(d.addons) ? d.addons : [] };
};
const save = (d) => writeJson(FILE, d);
const newId = () => crypto.randomBytes(6).toString('hex');

export const listAll = () => load();

// ---------- Links ----------
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32ToHex(s) {
  let bits = '';
  for (const c of s.toUpperCase()) {
    const v = BASE32.indexOf(c);
    if (v < 0) return null;
    bits += v.toString(2).padStart(5, '0');
  }
  let hex = '';
  for (let i = 0; i + 4 <= bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex.slice(0, 40);
}

// Magnet -> { infoHash, trackers, dn }. Também aceita só o hash (40 hex ou 32 base32).
export function parseMagnet(link) {
  const text = String(link || '').trim();
  if (/^[a-f0-9]{40}$/i.test(text)) return { infoHash: text.toLowerCase(), trackers: [], dn: '' };
  if (!/^magnet:\?/i.test(text)) return null;
  const params = new URLSearchParams(text.slice(text.indexOf('?') + 1));
  const xt = params.getAll('xt').find((v) => /^urn:btih:/i.test(v));
  if (!xt) return null;
  const raw = xt.slice(9);
  const infoHash = /^[a-f0-9]{40}$/i.test(raw) ? raw.toLowerCase() : /^[a-z2-7]{32}$/i.test(raw) ? base32ToHex(raw) : null;
  if (!infoHash) return null;
  return { infoHash, trackers: params.getAll('tr').filter((t) => /^(udp|https?|wss?):\/\//i.test(t)), dn: params.get('dn') || '' };
}

const HAS_PLACEHOLDER = /\{(s|e|S|E)\}/;
const fillUrl = (url, s, e) => url
  .replaceAll('{S}', String(s).padStart(2, '0')).replaceAll('{E}', String(e).padStart(2, '0'))
  .replaceAll('{s}', String(s)).replaceAll('{e}', String(e));

const int = (v) => (v === null || v === undefined || v === '' ? null : Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);

function validateSource(input) {
  const type = input.type === 'series' ? 'series' : input.type === 'movie' ? 'movie' : null;
  if (!type) throw new Error('Tipo inválido (filme ou série).');
  if (!/^tt\d+$/.test(input.imdb || '')) throw new Error('Escolha o título (ID do IMDb tt...).');
  const link = String(input.link || '').trim();
  if (!link) throw new Error('Cole o link da fonte.');
  const season = type === 'series' ? int(input.season) : null;
  const episode = type === 'series' && season !== null ? int(input.episode) : null;
  const fileIdx = int(input.fileIdx);
  if ([season, episode, fileIdx].some(Number.isNaN)) throw new Error('Temporada, episódio e índice do arquivo precisam ser números.');
  const out = {
    type, imdb: input.imdb, name: String(input.name || '').slice(0, 200),
    season, episode, label: String(input.label || '').trim().slice(0, 120),
    referer: String(input.referer || '').trim().slice(0, 500), userAgent: String(input.userAgent || '').trim().slice(0, 500),
  };
  const magnet = parseMagnet(link);
  if (magnet) return { ...out, kind: 'magnet', link, infoHash: magnet.infoHash, trackers: magnet.trackers, dn: magnet.dn, fileIdx };
  let url;
  try { url = new URL(link); } catch { throw new Error('Link não reconhecido: use magnet:?... ou http(s)://...'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('Link não reconhecido: use magnet:?... ou http(s)://...');
  if (type === 'series' && episode === null && !HAS_PLACEHOLDER.test(link)) {
    throw new Error('Link direto para a temporada/série inteira precisa de {S} e {E} no endereço (ex.: .../S{S}E{E}.mp4).');
  }
  return { ...out, kind: 'url', link, fileIdx: null };
}

export function addSource(input) {
  const d = load();
  const src = { id: newId(), ...validateSource(input), enabled: true, createdAt: new Date().toISOString() };
  d.sources.unshift(src);
  save(d);
  return src;
}
export function updateSource(id, patch) {
  const d = load();
  const i = d.sources.findIndex((s) => s.id === id);
  if (i < 0) throw new Error('Fonte não encontrada.');
  const cur = d.sources[i];
  const next = 'link' in patch || 'season' in patch || 'episode' in patch
    ? { ...cur, ...validateSource({ ...cur, ...patch }) } : { ...cur };
  if ('enabled' in patch) next.enabled = Boolean(patch.enabled);
  if ('label' in patch) next.label = String(patch.label || '').trim().slice(0, 120);
  d.sources[i] = next;
  save(d);
  return next;
}
export function removeSource(id) {
  const d = load();
  d.sources = d.sources.filter((s) => s.id !== id);
  save(d);
}

// ---------- Outros addons ----------
const normAddonUrl = (u) => String(u || '').trim().replace(/^stremio:\/\//i, 'https://');
const addonBase = (u) => u.replace(/\/manifest\.json(\?.*)?$/i, '');

async function fetchJson(url, ms = 10_000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function addAddon(rawUrl) {
  const url = normAddonUrl(rawUrl);
  if (!/^https?:\/\/.+\/manifest\.json(\?.*)?$/i.test(url)) throw new Error('A URL do addon precisa terminar em /manifest.json.');
  if (/\/fontes\/manifest\.json/i.test(url)) throw new Error('Esse é o próprio "Minhas fontes".');
  const d = load();
  if (d.addons.some((a) => a.url === url)) throw new Error('Esse addon já está na lista.');
  let m;
  try { m = await fetchJson(url); } catch (e) { throw new Error(`Não consegui abrir o manifest (${e.message}).`); }
  const hasStream = (m.resources || []).some((r) => r === 'stream' || r?.name === 'stream');
  if (!hasStream) throw new Error(`"${m.name || 'Esse addon'}" não fornece fontes (stream).`);
  const addon = { id: newId(), url, name: String(m.name || 'Addon').slice(0, 80), types: m.types || [], enabled: true, createdAt: new Date().toISOString() };
  d.addons.push(addon);
  save(d);
  return addon;
}
export function updateAddon(id, patch) {
  const d = load();
  const a = d.addons.find((x) => x.id === id);
  if (!a) throw new Error('Addon não encontrado.');
  if ('enabled' in patch) a.enabled = Boolean(patch.enabled);
  save(d);
  return a;
}
export function removeAddon(id) {
  const d = load();
  d.addons = d.addons.filter((a) => a.id !== id);
  save(d);
}

// ---------- Arquivos de um torrent (pacotes de temporada/série) ----------
// Pergunta ao Stremio Service (porta 11470) a lista de arquivos e guarda em disco para a próxima vez.
const filesCache = readJson(FILES_CACHE, {});
const filesPending = new Map();
export function torrentFiles(src) {
  if (filesCache[src.infoHash]) return Promise.resolve(filesCache[src.infoHash]);
  if (filesPending.has(src.infoHash)) return filesPending.get(src.infoHash);
  const p = (async () => {
    // Só o infoHash: com "peerSearch" o servidor fica esperando a busca de peers e não devolve a lista.
    const body = { torrent: { infoHash: src.infoHash } };
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`${STREAM_SERVER}/${src.infoHash}/create`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
      });
      const j = await r.json();
      if (j.files?.length) {
        const files = j.files.map((f, idx) => ({ idx, name: f.name, path: f.path, length: f.length }));
        filesCache[src.infoHash] = files;
        writeJson(FILES_CACHE, filesCache);
        return files;
      }
      await new Promise((ok) => setTimeout(ok, 2000));
    }
    throw new Error('o torrent ainda não respondeu (sem seeds?)');
  })().finally(() => filesPending.delete(src.infoHash));
  filesPending.set(src.infoHash, p);
  return p;
}

// Descobre temporada/episódio pelo nome do arquivo: S01E02, 1x02, "Temporada 1/Episódio 2", "E02", "02 - Nome".
export function episodeOf(file, defaultSeason) {
  const name = file.name || '';
  const dir = (file.path || '').replace(/[\\/][^\\/]*$/, '');
  let m = name.match(/S(\d{1,2})[ ._-]*E(\d{1,3})(?!\d)/i) || name.match(/(?:^|[^\d])(\d{1,2})x(\d{2,3})(?!\d)/i);
  if (m) return { s: Number(m[1]), e: Number(m[2]) };
  m = name.match(/(?:temporada|season)[ ._-]*(\d{1,2}).*?(?:epis[oó]dio|episode|ep)[ ._-]*(\d{1,3})/i);
  if (m) return { s: Number(m[1]), e: Number(m[2]) };
  const ep = name.match(/(?:^|[^a-z])(?:e|ep|episode|epis[oó]dio|cap[ií]tulo)[ ._-]*(\d{1,3})(?!\d)/i) || name.match(/^(\d{1,3})(?![\dp])/i);
  if (!ep) return null;
  const sDir = dir.match(/(?:season|temporada|^s|[\\/ ._-]s)[ ._-]*(\d{1,2})(?!\d)/i);
  const s = sDir ? Number(sDir[1]) : defaultSeason;
  return s === null || s === undefined ? null : { s, e: Number(ep[1]) };
}

function pickEpisodeFile(files, season, episode, packSeason) {
  const hits = files.filter((f) => VIDEO_EXT.test(f.name || '')).filter((f) => {
    const se = episodeOf(f, packSeason);
    return se && se.s === season && se.e === episode;
  });
  return hits.sort((a, b) => (b.length || 0) - (a.length || 0))[0] || null;
}

// ---------- Fontes para o Stremio ----------
const fmtSize = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${Math.round(n / 1e6)} MB` : '');

function urlStream(src, url) {
  const isWeb = /\.(mp4|m3u8)(\?|$)/i.test(url) && !src.referer && !src.userAgent;
  const request = {};
  if (src.referer) request.Referer = src.referer;
  if (src.userAgent) request['User-Agent'] = src.userAgent;
  return {
    url,
    name: '⭐ Minhas fontes',
    title: [src.label || 'Link direto', decodeURIComponent(url.split('/').pop().split('?')[0] || '')].filter(Boolean).join('\n'),
    behaviorHints: {
      bingeGroup: `minhas-fontes-${src.id}`,
      ...(isWeb ? {} : { notWebReady: true }),
      ...(Object.keys(request).length ? { proxyHeaders: { request } } : {}),
    },
  };
}

function torrentStream(src, file) {
  return {
    infoHash: src.infoHash,
    ...(file ? { fileIdx: file.idx } : src.fileIdx !== null && src.fileIdx !== undefined ? { fileIdx: src.fileIdx } : {}),
    sources: [...src.trackers.map((t) => `tracker:${t}`), `dht:${src.infoHash}`],
    name: '⭐ Minhas fontes',
    title: [src.label || 'Magnet', file ? `${file.name}${file.length ? ` · ${fmtSize(file.length)}` : ''}` : src.dn].filter(Boolean).join('\n'),
    behaviorHints: { bingeGroup: `minhas-fontes-${src.id}`, ...(file ? { filename: file.name } : {}) },
  };
}

async function ownStreams(type, imdb, season, episode, notes) {
  const list = load().sources.filter((s) => s.enabled !== false && s.imdb === imdb && s.type === type);
  const out = [];
  for (const src of list) {
    if (type === 'movie') {
      out.push(src.kind === 'url' ? urlStream(src, src.link) : torrentStream(src, null));
      continue;
    }
    if (src.season !== null && src.season !== season) continue;
    if (src.episode !== null && src.episode !== episode) continue;
    if (src.kind === 'url') {
      out.push(urlStream(src, src.episode !== null ? src.link : fillUrl(src.link, season, episode)));
    } else if (src.episode !== null) {
      out.push(torrentStream(src, null));
    } else {
      // Pacote de temporada/série: acha o arquivo do episódio dentro do torrent.
      try {
        const file = pickEpisodeFile(await torrentFiles(src), season, episode, src.season);
        if (file) out.push(torrentStream(src, file));
        else notes?.push(`${src.label || src.dn || 'Pacote'}: não achei o arquivo do T${season}:E${episode}.`);
      } catch (e) {
        notes?.push(`${src.label || src.dn || 'Pacote'}: ${e.message}`);
      }
    }
  }
  return out;
}

async function addonStreams(type, id, notes) {
  const addons = load().addons.filter((a) => a.enabled !== false && (!a.types?.length || a.types.includes(type)));
  const lists = await Promise.all(addons.map(async (a) => {
    try {
      const j = await fetchJson(`${addonBase(a.url)}/stream/${type}/${encodeURIComponent(id)}.json`, 12_000);
      return (j.streams || []).map((s) => ({ ...s, name: `${a.name}${s.name ? `\n${s.name}` : ''}` }));
    } catch (e) {
      notes?.push(`${a.name}: ${e.message}`);
      return [];
    }
  }));
  return lists.flat();
}

export async function streamsFor(type, id, notes) {
  const [imdb, s, e] = id.split(':');
  if (!/^tt\d+$/.test(imdb)) return [];
  const season = type === 'series' ? Number(s) : null;
  const episode = type === 'series' ? Number(e) : null;
  if (type === 'series' && !(season >= 0 && episode >= 0)) return [];
  const [own, other] = await Promise.all([ownStreams(type, imdb, season, episode, notes), addonStreams(type, id, notes)]);
  return [...own, ...other];
}

export const fontesManifest = (base) => ({
  id: 'community.streaming-modes.fontes',
  version: '1.0.0',
  name: 'Minhas fontes',
  description: 'Links que você cadastrou (vídeo direto, magnet e outros addons). Funciona só neste PC, com o addon local ligado.',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
  logo: `${base}/fontes/logo.svg`,
  behaviorHints: { configurable: true, configurationRequired: false },
});
