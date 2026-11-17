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

// release: { country, types, kind } usa a data de lançamento daquele país/tipo
// (ex.: estreia nos cinemas do Brasil = BR tipos 2|3; estreia digital nos EUA = US tipo 4).
async function upcomingItem(type, base, release) {
  const t = type === 'movie' ? 'movie' : 'tv';
  const append = release ? 'images,release_dates' : 'images';
  const d = await tmdb(`/${t}/${base.id}`, { append_to_response: append, include_image_language: 'pt,en,null' });
  let date = type === 'movie' ? d.release_date : d.first_air_date;
  let kind = type === 'movie' ? 'Filme' : 'Série';
  if (release) {
    const dates = d.release_dates?.results?.find((r) => r.iso_3166_1 === release.country)?.release_dates || [];
    const hit = dates.filter((x) => release.types.includes(x.type)).map((x) => x.release_date.slice(0, 10)).sort().find((x) => x >= day(0));
    if (!hit) return null;
    // Relançamento de filme antigo (ex.: Star Wars de 1977 de volta aos cinemas) não é novidade: já está no catálogo.
    if (d.release_date && d.release_date < day(-365)) return null;
    date = hit;
    kind = release.kind;
  }
  // Série que já existe e vai ganhar temporada nova.
  if (type === 'series' && d.next_episode_to_air && (d.first_air_date || '') < day(0)) {
    date = d.next_episode_to_air.air_date;
    kind = d.next_episode_to_air.episode_number === 1 ? `Temporada ${d.next_episode_to_air.season_number}` : 'Novos episódios';
  }
  if (kind === 'Novos episódios') return null; // episódio semanal não é estreia
  if (/^Temporada (\d+)$/.test(kind) && Number(kind.slice(10)) > 25) return null; // premiações e programas anuais (Oscars 75...)
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
    // provider.upcoming (opcional): redes extras, janela maior e filmes do estúdio (Disney+).
    const up = provider.upcoming || {};
    const until = day(up.days || 60);
    const networks = up.networks || provider.tmdbNetworkId;
    const none = Promise.resolve({ results: [] });
    const [newSeries, returning, movies, digital, theaters] = await Promise.all([
      discover('series', { with_networks: networks, 'first_air_date.gte': day(0), 'first_air_date.lte': until, sort_by: 'popularity.desc' }),
      discover('series', { with_networks: networks, 'air_date.gte': day(0), 'air_date.lte': until,
        'first_air_date.lte': day(-1), sort_by: 'popularity.desc', 'vote_count.gte': 50 }),
      provider.key === 'netflix'
        ? discover('movie', { with_companies: NETFLIX_COMPANIES, 'primary_release_date.gte': day(0), 'primary_release_date.lte': until, sort_by: 'popularity.desc' })
        : none,
      // Estreias digitais do estúdio (data dos EUA, que costuma ser a mesma da Disney+ no Brasil).
      up.movieCompanies
        ? discover('movie', { with_companies: up.movieCompanies, with_release_type: '4', region: 'US', 'release_date.gte': day(0), 'release_date.lte': until, sort_by: 'popularity.desc' })
        : none,
      // Próximos filmes do estúdio nos cinemas do Brasil (chegam à Disney+ meses depois).
      up.movieCompanies
        ? discover('movie', { with_companies: up.movieCompanies, with_release_type: '2|3', region: config.region, 'release_date.gte': day(0), 'release_date.lte': until, sort_by: 'popularity.desc' })
        : none,
    ].map((p) => p.catch(() => ({ results: [] }))));
    const many = up.days ? 2 : 1;
    const pool = [
      ...(newSeries.results || []).slice(0, 14 * many).map((x) => ['series', x]),
      ...(returning.results || []).slice(0, 10 * many).map((x) => ['series', x]),
      ...(movies.results || []).slice(0, 10).map((x) => ['movie', x]),
      ...(digital.results || []).slice(0, 12).map((x) => ['movie', x, { country: 'US', types: [4], kind: 'Filme' }]),
      ...(theaters.results || []).slice(0, 12).map((x) => ['movie', x, { country: config.region, types: [2, 3], kind: 'Nos cinemas' }]),
    ];
    const seen = new Set();
    const items = (await mapLimit(pool, 6, ([type, x, rel]) => upcomingItem(type, x, rel).catch(() => null)))
      .filter((it) => it && !seen.has(it.id) && seen.add(it.id));
    return items.sort((a, b) => a.date.localeCompare(b.date));
  });
}
