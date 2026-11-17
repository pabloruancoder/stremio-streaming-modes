import { config } from './config.js';
import { cached, persistentMap, mapLimit } from './cache.js';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const HOUR = 3600_000;

const imdbIds = persistentMap('imdb-ids');

// No máximo 16 requisições ao TMDB ao mesmo tempo (o build do catálogo completo faz milhares).
const MAX_PARALLEL = 16;
let running = 0;
const waiting = [];
async function slot(fn) {
  if (running >= MAX_PARALLEL) await new Promise((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function tmdb(pathname, params = {}) {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries({ language: config.language, ...params })) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const headers = { accept: 'application/json' };
  if (config.tmdbReadToken) headers.authorization = `Bearer ${config.tmdbReadToken}`;
  else url.searchParams.set('api_key', config.tmdbApiKey);

  // Tenta de novo em limite de taxa (429), erro do servidor (5xx) ou falha de rede.
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await slot(() => fetch(url, { headers }));
    } catch (err) {
      if (attempt < 5) { await sleep(1000 * (attempt + 1)); continue; }
      throw err;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`TMDB ${res.status} em ${pathname}`);
    return res.json();
  }
}

const tmdbType = (type) => (type === 'movie' ? 'movie' : 'tv');

// O Stremio e os addons de streams trabalham com IDs do IMDb (tt...),
// então todo item do TMDB precisa ser convertido.
export async function imdbIdFor(type, tmdbId) {
  const key = `${tmdbType(type)}:${tmdbId}`;
  if (imdbIds.has(key)) return imdbIds.get(key);
  const ext = await tmdb(`/${tmdbType(type)}/${tmdbId}/external_ids`, { language: undefined });
  const id = ext.imdb_id || null;
  imdbIds.set(key, id);
  return id;
}

export function discover(type, params, page = 1) {
  const p = { page, watch_region: config.region, ...params };
  const key = `discover:${type}:${JSON.stringify(p)}`;
  return cached(key, 3 * HOUR, () => tmdb(`/discover/${tmdbType(type)}`, p));
}

export function search(type, query, language = config.language) {
  return cached(`search:${type}:${language}:${query}`, 24 * HOUR, () =>
    tmdb(`/search/${tmdbType(type)}`, { query, include_adult: false, language }),
  );
}

export function details(type, tmdbId) {
  return cached(`details:${type}:${tmdbId}`, 24 * HOUR, () => tmdb(`/${tmdbType(type)}/${tmdbId}`));
}

export function watchProviders(type, tmdbId) {
  return cached(`wp:${type}:${tmdbId}`, 24 * HOUR, () =>
    tmdb(`/${tmdbType(type)}/${tmdbId}/watch/providers`, { language: undefined }),
  );
}

export async function isOnProvider(type, tmdbId, providerId) {
  const data = await watchProviders(type, tmdbId);
  const region = data.results?.[config.region];
  const lists = [region?.flatrate, region?.ads, region?.free].filter(Boolean).flat();
  return lists.some((p) => p.provider_id === providerId);
}

const DAY = 24 * HOUR;

// O TMDB devolve alguns gêneros de série em inglês mesmo em pt-BR.
export const GENRE_PT = {
  'Action & Adventure': 'Ação e aventura', 'Sci-Fi & Fantasy': 'Ficção científica e fantasia',
  'War & Politics': 'Guerra e política', Kids: 'Infantil', News: 'Jornalismo', Reality: 'Reality show',
  Soap: 'Novela', Talk: 'Talk show',
};

function genreMap(type) {
  return cached(`genres:${type}`, 7 * DAY, async () => {
    const { genres = [] } = await tmdb(`/genre/${tmdbType(type)}/list`);
    return Object.fromEntries(genres.map((g) => [g.id, GENRE_PT[g.name] || g.name]));
  });
}

const tmdbIds = persistentMap('tmdb-ids');

export async function tmdbIdFromImdb(type, imdb) {
  const key = `${tmdbType(type)}:${imdb}`;
  if (tmdbIds.has(key)) return tmdbIds.get(key);
  const r = await tmdb(`/find/${imdb}`, { external_source: 'imdb_id', language: undefined });
  const hit = (type === 'movie' ? r.movie_results : r.tv_results)?.[0];
  const id = hit?.id ?? null;
  tmdbIds.set(key, id);
  return id;
}

function pickTrailer(videos = []) {
  const yt = videos.filter((v) => v.site === 'YouTube');
  const score = (v) =>
    (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) +
    (v.iso_639_1 === 'pt' ? 2 : 0) +
    (v.official ? 1 : 0);
  return yt.sort((a, b) => score(b) - score(a))[0]?.key || null;
}

function certification(type, d) {
  if (type === 'movie') {
    const br = d.release_dates?.results?.find((r) => r.iso_3166_1 === 'BR');
    return br?.release_dates?.map((x) => x.certification).find(Boolean) || null;
  }
  return d.content_ratings?.results?.find((r) => r.iso_3166_1 === 'BR')?.rating || null;
}

// Detalhes completos em pt-BR para a janela "Mais informações".
export function fullDetails(type, imdb) {
  return cached(`full:${type}:${imdb}`, DAY, async () => {
    const id = await tmdbIdFromImdb(type, imdb);
    if (!id) return null;
    const append = type === 'movie' ? 'credits,videos,release_dates' : 'aggregate_credits,videos,content_ratings';
    const d = await tmdb(`/${tmdbType(type)}/${id}`, {
      append_to_response: append,
      include_video_language: 'pt,en,null',
    });
    const credits = d.credits || d.aggregate_credits || {};
    const date = d.release_date || d.first_air_date || '';
    return {
      id: imdb,
      type,
      name: d.title || d.name,
      description: d.overview || '',
      tagline: d.tagline || '',
      year: date.slice(0, 4),
      runtime: d.runtime || d.episode_run_time?.[0] || null,
      seasonsCount: d.number_of_seasons || null,
      genres: (d.genres || []).map((g) => GENRE_PT[g.name] || g.name),
      cast: (credits.cast || []).slice(0, 6).map((c) => c.name),
      creators: (d.created_by || []).map((c) => c.name).concat(
        (credits.crew || []).filter((c) => c.job === 'Director').map((c) => c.name),
      ).slice(0, 3),
      rating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      certification: certification(type, d),
      trailer: pickTrailer(d.videos?.results),
      background: d.backdrop_path ? `${IMG}/w1280${d.backdrop_path}` : undefined,
      poster: d.poster_path ? `${IMG}/w500${d.poster_path}` : undefined,
      logo: `https://images.metahub.space/logo/medium/${imdb}/img`,
      seasons: (d.seasons || [])
        .filter((s) => s.season_number > 0 && s.episode_count > 0)
        .map((s) => ({ number: s.season_number, name: s.name, episodes: s.episode_count })),
    };
  });
}

export function seasonEpisodes(imdb, number) {
  return cached(`season:${imdb}:${number}`, DAY, async () => {
    const id = await tmdbIdFromImdb('series', imdb);
    if (!id) return [];
    const s = await tmdb(`/tv/${id}/season/${number}`);
    return (s.episodes || []).map((e) => ({
      id: `${imdb}:${number}:${e.episode_number}`, // formato de vídeo do Stremio/Cinemeta
      episode: e.episode_number,
      name: e.name,
      description: e.overview || '',
      still: e.still_path ? `${IMG}/w300${e.still_path}` : null,
      runtime: e.runtime || null,
      released: e.air_date || null,
    }));
  });
}

// Recomendações do TMDB filtradas para o que está no streaming.
export function similarOnProvider(type, imdb, providerId) {
  return cached(`similar:${type}:${imdb}:${providerId}`, DAY, async () => {
    const id = await tmdbIdFromImdb(type, imdb);
    if (!id) return [];
    const [rec, sim] = await Promise.all([
      tmdb(`/${tmdbType(type)}/${id}/recommendations`).catch(() => ({ results: [] })),
      tmdb(`/${tmdbType(type)}/${id}/similar`).catch(() => ({ results: [] })),
    ]);
    const seen = new Set();
    const pool = [...(rec.results || []), ...(sim.results || [])].filter(
      (x) => !seen.has(x.id) && seen.add(x.id),
    );
    const candidates = pool.slice(0, 40);
    const checks = await mapLimit(candidates, 10, (x) => isOnProvider(type, x.id, providerId).catch(() => false));
    const onIt = candidates.filter((_, i) => checks[i]).slice(0, 18);
    const metas = await Promise.all(onIt.map((x) => toMetaPreview(x, type, 'landscape').catch(() => null)));
    return metas.filter(Boolean);
  });
}

// Converte um resultado do TMDB em "meta preview" do Stremio.
export async function toMetaPreview(item, type, shape) {
  const id = await imdbIdFor(type, item.id);
  if (!id) return null;
  const gmap = await genreMap(type).catch(() => ({}));
  const genres = (item.genre_ids || (item.genres || []).map((g) => g.id))
    .map((g) => gmap[g])
    .filter(Boolean)
    .slice(0, 3);
  const date = item.release_date || item.first_air_date || '';
  const landscape = shape === 'landscape' && item.backdrop_path;
  const poster = landscape
    ? `${IMG}/w780${item.backdrop_path}`
    : item.poster_path
      ? `${IMG}/w500${item.poster_path}`
      : undefined;
  return {
    id,
    type,
    name: item.title || item.name,
    poster,
    posterShape: landscape ? 'landscape' : 'poster',
    background: item.backdrop_path ? `${IMG}/w1280${item.backdrop_path}` : undefined,
    logo: `https://images.metahub.space/logo/medium/${id}/img`,
    description: item.overview || undefined,
    releaseInfo: date.slice(0, 4) || undefined,
    genres,
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : undefined,
  };
}
