// "Novidades e populares": estreias que ainda vão chegar ao streaming (Em breve).
import { config } from './config.js';
import { cached, mapLimit } from './cache.js';
import { tmdb, discover, imdbIdFor, GENRE_PT } from './tmdb.js';

const HOUR = 3600_000;
const IMG = 'https://image.tmdb.org/t/p';
// Produtoras da Netflix no TMDB (EUA, International Pictures, Animation, Japão, Reino Unido).
const NETFLIX_COMPANIES = '178464|145174|171251|185004|198834';
const day = (offset) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

// Logo do título (preferência pt, depois en, depois sem idioma).
function pickLogo(images) {
  const logos = images?.logos || [];
  const by = (lang) => logos.find((l) => l.iso_639_1 === lang);
  const l = by('pt') || by('en') || by(null) || logos[0];
  return l ? `${IMG}/w500${l.file_path}` : undefined;
}

async function upcomingItem(type, base) {
  const t = type === 'movie' ? 'movie' : 'tv';
  const d = await tmdb(`/${t}/${base.id}`, { append_to_response: 'images', include_image_language: 'pt,en,null' });
  let date = type === 'movie' ? d.release_date : d.first_air_date;
  let kind = type === 'movie' ? 'Filme' : 'Série';
  // Série que já existe e vai ganhar temporada nova.
  if (type === 'series' && d.next_episode_to_air && (d.first_air_date || '') < day(0)) {
    date = d.next_episode_to_air.air_date;
    kind = d.next_episode_to_air.episode_number === 1 ? `Temporada ${d.next_episode_to_air.season_number}` : 'Novos episódios';
  }
  if (kind === 'Novos episódios') return null; // episódio semanal não é estreia
  if ((d.genres || []).some((g) => [10763, 10766, 10767].includes(g.id))) return null; // jornal, novela, talk show
  if (!date || date < day(0)) return null;
  const imdb = await imdbIdFor(type, base.id).catch(() => null);
  const backdrop = d.backdrop_path || base.backdrop_path;
  if (!backdrop) return null;
  return {
    id: imdb || `tmdb:${t}:${base.id}`,
    type,
    name: d.title || d.name,
    description: d.overview || undefined,
    background: `${IMG}/w1280${backdrop}`,
    poster: `${IMG}/w780${backdrop}`,
    posterShape: 'landscape',
    logo: pickLogo(d.images) || (imdb ? `https://images.metahub.space/logo/medium/${imdb}/img` : undefined),
    genres: (d.genres || []).map((g) => GENRE_PT[g.name] || g.name).slice(0, 3),
    date,
    kind,
    playable: Boolean(imdb),
  };
}

export function upcoming(provider) {
  return cached(`upcoming:${provider.key}:${config.region}`, 6 * HOUR, async () => {
    if (!provider.tmdbNetworkId) return [];
    const until = day(60);
    const [newSeries, returning, movies] = await Promise.all([
      discover('series', { with_networks: provider.tmdbNetworkId, 'first_air_date.gte': day(0), 'first_air_date.lte': until, sort_by: 'popularity.desc' }),
      discover('series', { with_networks: provider.tmdbNetworkId, 'air_date.gte': day(0), 'air_date.lte': until,
        'first_air_date.lte': day(-1), sort_by: 'popularity.desc', 'vote_count.gte': 50 }),
      provider.key === 'netflix'
        ? discover('movie', { with_companies: NETFLIX_COMPANIES, 'primary_release_date.gte': day(0), 'primary_release_date.lte': until, sort_by: 'popularity.desc' })
        : Promise.resolve({ results: [] }),
    ].map((p) => p.catch(() => ({ results: [] }))));
    const pool = [
      ...(newSeries.results || []).slice(0, 14).map((x) => ['series', x]),
      ...(returning.results || []).slice(0, 10).map((x) => ['series', x]),
      ...(movies.results || []).slice(0, 10).map((x) => ['movie', x]),
    ];
    const seen = new Set();
    const items = (await mapLimit(pool, 6, ([type, x]) => upcomingItem(type, x).catch(() => null)))
      .filter((it) => it && !seen.has(it.id) && seen.add(it.id));
    return items.sort((a, b) => a.date.localeCompare(b.date));
  });
}
