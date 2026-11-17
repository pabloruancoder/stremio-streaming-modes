// Dados para o player no estilo Netflix: "Pular abertura" (animes, via AniSkip) e "Próximo episódio" (via Cinemeta).
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { cached } from './cache.js';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const ANIME_LIST_URL = 'https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json';
const ANIME_LIST_FILE = path.join(config.dataDir, 'anime-list.json');

// ---------- Episódios (Cinemeta, o catálogo oficial do Stremio) ----------
function cinemetaVideos(imdb) {
  return cached(`cinemeta:videos:${imdb}`, 6 * HOUR, async () => {
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/series/${imdb}.json`);
    if (!res.ok) throw new Error(`Cinemeta ${res.status}`);
    const { meta } = await res.json();
    const videos = (meta?.videos || [])
      .filter((v) => v.season > 0 && v.episode > 0)
      .sort((a, b) => a.season - b.season || a.episode - b.episode);
    return { name: meta?.name, videos };
  });
}

export async function nextEpisode(imdb, season, episode) {
  const { name, videos } = await cinemetaVideos(imdb);
  const i = videos.findIndex((v) => v.season === season && v.episode === episode);
  const next = i >= 0 ? videos[i + 1] : null;
  if (!next) return null;
  const released = next.released ? new Date(next.released) : null;
  if (released && released > new Date()) return null; // ainda não lançado
  return {
    id: next.id || `${imdb}:${next.season}:${next.episode}`,
    season: next.season,
    episode: next.episode,
    title: next.name || next.title || `Episódio ${next.episode}`,
    description: next.overview || next.description || undefined,
    thumbnail: next.thumbnail || undefined,
    series: name,
  };
}

// ---------- Lista de animes (IMDb -> MyAnimeList, por temporada) ----------
function animeIndex() {
  return cached('anime-list', 7 * DAY, async () => {
    let list = null;
    try {
      const st = fs.statSync(ANIME_LIST_FILE);
      if (Date.now() - st.mtimeMs < 7 * DAY) list = JSON.parse(fs.readFileSync(ANIME_LIST_FILE, 'utf8'));
    } catch { /* sem cópia local */ }
    if (!list) {
      const res = await fetch(ANIME_LIST_URL);
      if (!res.ok) throw new Error(`lista de animes: HTTP ${res.status}`);
      list = await res.json();
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(ANIME_LIST_FILE, JSON.stringify(list));
    }
    const byImdb = new Map();
    for (const a of list) {
      if (!a.mal_id) continue;
      for (const id of [].concat(a.imdb_id || [])) {
        if (!byImdb.has(id)) byImdb.set(id, []);
        byImdb.get(id).push({ mal: a.mal_id, season: a.season?.tvdb ?? null, offset: a.episode_offset || 0, type: a.type });
      }
    }
    return byImdb;
  });
}

// Descobre o anime do MyAnimeList e o número do episódio nele.
async function malEpisode(imdb, season, episode) {
  const index = await animeIndex();
  const entries = (index.get(imdb) || []).filter((e) => e.type === 'TV' || e.type === 'ONA');
  if (!entries.length) return null;
  // Anime dividido por temporada (cada temporada é um anime no MyAnimeList).
  const bySeason = entries.filter((e) => e.season === season && e.offset < episode).sort((a, b) => b.offset - a.offset)[0];
  if (bySeason) return { mal: bySeason.mal, ep: episode - bySeason.offset };
  // Anime com numeração contínua (ex.: One Piece): converte temporada/episódio em número absoluto.
  const absolute = entries.find((e) => e.season === null);
  if (!absolute) return null;
  const { videos } = await cinemetaVideos(imdb);
  const i = videos.findIndex((v) => v.season === season && v.episode === episode);
  return i >= 0 ? { mal: absolute.mal, ep: i + 1 } : null;
}

export function skipTimes(imdb, season, episode, length) {
  const len = Math.round(Number(length) || 0);
  return cached(`skip:${imdb}:${season}:${episode}:${Math.round(len / 30)}`, DAY, async () => {
    const target = await malEpisode(imdb, season, episode).catch(() => null);
    if (!target) return { intro: null, outro: null };
    const url = `https://api.aniskip.com/v2/skip-times/${target.mal}/${target.ep}?types=op&types=ed&types=recap&episodeLength=${len}`;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return { intro: null, outro: null };
    const data = await res.json().catch(() => ({}));
    const pick = (type) => {
      const r = (data.results || []).find((x) => x.skipType === type);
      return r ? [r.interval.startTime, r.interval.endTime] : null;
    };
    return { intro: pick('op') || pick('recap'), outro: pick('ed'), source: 'AniSkip' };
  });
}
