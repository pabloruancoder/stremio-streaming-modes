import { config, hasTmdb } from './config.js';
import { mapLimit } from './cache.js';
import { discover, toMetaPreview } from './tmdb.js';
import { top10Metas } from './top10.js';
import { PROVIDERS, NAME_SEPARATOR } from './providers.js';

const today = () => new Date().toISOString().slice(0, 10);

// Fileiras de cada streaming, na ordem em que aparecem na Home.
// kind: 'top10' (ranking oficial) ou 'discover' (TMDB filtrado pelo streaming).
function rowsFor(p) {
  const card = config.cardStyle;
  const rows = [];
  if (p.hasOfficialTop10) {
    rows.push(
      { id: 'top10-series', type: 'series', name: 'Top 10 séries da semana no Brasil', kind: 'top10' },
      { id: 'top10-movies', type: 'movie', name: 'Top 10 filmes da semana no Brasil', kind: 'top10' },
    );
  }
  if (p.tmdbNetworkId) {
    rows.push({
      id: 'originals', type: 'series', name: `Só na ${p.label}`, kind: 'discover', shape: 'poster',
      params: { with_networks: p.tmdbNetworkId, sort_by: 'popularity.desc', 'first_air_date.gte': '2013-01-01', 'vote_count.gte': 30 },
      noProviderFilter: true,
    });
  }
  rows.push(
    { id: 'trending-series', type: 'series', name: 'Séries em alta', kind: 'discover', shape: card,
      params: { sort_by: 'popularity.desc' } },
    { id: 'trending-movies', type: 'movie', name: 'Filmes em alta', kind: 'discover', shape: card,
      params: { sort_by: 'popularity.desc' } },
    { id: 'new-movies', type: 'movie', name: 'Lançamentos', kind: 'fresh', shape: card, days: 30 },
    { id: 'new-series', type: 'series', name: 'Séries novas', kind: 'fresh', shape: card, days: 60 },
    { id: 'acclaimed-movies', type: 'movie', name: 'Filmes aclamados pela crítica', kind: 'discover', shape: card,
      params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1500 } },
    { id: 'acclaimed-series', type: 'series', name: 'Séries aclamadas pela crítica', kind: 'discover', shape: card,
      params: { sort_by: 'vote_average.desc', 'vote_count.gte': 800 } },
  );
  const genre = (id, type, name, params) =>
    rows.push({ id, type, name, kind: 'discover', shape: card, params: { sort_by: 'popularity.desc', ...params } });
  genre('action-movies', 'movie', 'Filmes de ação', { with_genres: 28 });
  genre('comedy-movies', 'movie', 'Comédias', { with_genres: 35 });
  genre('drama-series', 'series', 'Séries de drama', { with_genres: 18 });
  genre('crime-series', 'series', 'Séries policiais', { with_genres: 80 });
  genre('horror-movies', 'movie', 'Filmes de terror', { with_genres: 27 });
  genre('scifi-movies', 'movie', 'Ficção científica e fantasia', { with_genres: '878|14' });
  genre('romance-movies', 'movie', 'Filmes românticos', { with_genres: 10749 });
  genre('anime-series', 'series', 'Animes', { with_genres: 16, with_original_language: 'ja' });
  genre('kids-movies', 'movie', 'Para a família', { with_genres: '10751|16', certification_country: 'BR', certification: 'L|10' });
  // Fileiras do perfil Infantil (classificação Livre/10 anos nos filmes; séries do gênero Kids).
  genre('kids-anim-movies', 'movie', 'Animações', { with_genres: 16, certification_country: 'BR', certification: 'L' });
  genre('kids-series', 'series', 'Séries infantis', { with_genres: 10762 });
  genre('kids-family-series', 'series', 'Desenhos e séries para toda a família', { with_genres: '10762|10751', without_genres: '80,18,27,10765,99' });
  genre('docs', 'movie', 'Documentários', { with_genres: 99 });
  genre('reality-series', 'series', 'Reality shows', { with_genres: 10764 });
  genre('br-series', 'series', 'Séries brasileiras', { with_origin_country: 'BR' });
  return rows;
}

// Índice: "netflix.top10-series" -> { provider, row }
const index = new Map();
for (const p of Object.values(PROVIDERS)) {
  for (const row of rowsFor(p)) index.set(`${p.key}.${row.id}`, { provider: p, row });
}

export function manifestCatalogs() {
  const out = [];
  for (const [id, { provider, row }] of index) {
    if (row.kind !== 'top10' && !hasTmdb()) continue; // sem TMDB, só o Top 10 funciona
    out.push({
      id,
      type: row.type,
      name: `${provider.label}${NAME_SEPARATOR}${row.name}`,
      extra: row.kind === 'top10' ? [] : [{ name: 'skip', isRequired: false }],
    });
  }
  return out;
}

const PAGE = 20;

// Estreias recentes no streaming. A popularidade do TMDB é mundial (um lançamento americano
// chega a 20x a de um documentário brasileiro que está bombando aqui), então as produções do
// país das últimas 3 semanas vêm primeiro e o resto segue por popularidade.
async function freshReleases(type, provider, row, part = 0) {
  const since = new Date(Date.now() - row.days * 86400_000).toISOString().slice(0, 10);
  const dateKey = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const params = {
    sort_by: 'popularity.desc',
    [`${dateKey}.gte`]: since,
    [`${dateKey}.lte`]: today(),
    with_watch_providers: provider.tmdbProviderId,
    with_watch_monetization_types: 'flatrate|ads',
  };
  const pages = await Promise.all([part * 2 + 1, part * 2 + 2].map((p) => discover(type, params, p).catch(() => ({ results: [] }))));
  const lang = config.language.slice(0, 2);
  const recent = new Date(Date.now() - 21 * 86400_000).toISOString().slice(0, 10);
  const isLocalNew = (x) =>
    (x.original_language === lang || (x.origin_country || []).includes(config.region)) &&
    (x.release_date || x.first_air_date || '') >= recent;
  const all = pages.flatMap((p) => p.results || []);
  const ranked = part ? all : [...all.filter(isLocalNew), ...all.filter((x) => !isLocalNew(x))];
  const metas = await mapLimit(ranked, 8, (item) => toMetaPreview(item, type, row.shape).catch(() => null));
  return metas.filter(Boolean);
}

export async function catalogHandler(type, id, extra) {
  const entry = index.get(id);
  if (!entry || entry.row.type !== type) return { metas: [] };
  const { provider, row } = entry;
  const skip = Number(extra.skip) || 0;

  if (row.kind === 'top10') {
    if (skip > 0) return { metas: [] };
    return { metas: await top10Metas(type, provider), cacheMaxAge: 3 * 3600 };
  }

  if (!hasTmdb()) return { metas: [] };

  if (row.kind === 'fresh') {
    const part = Math.floor(skip / 20);
    if (part > 10) return { metas: [] };
    return { metas: await freshReleases(type, provider, row, part), cacheMaxAge: 3 * 3600 };
  }

  // Alguns itens são descartados por não terem IMDb id, então o "skip" do Stremio
  // fica um pouco abaixo de múltiplos de 20. Arredonda para a página certa.
  const page = Math.floor((skip + PAGE / 2) / PAGE) + 1;
  if (page > 20) return { metas: [] };
  const params = typeof row.params === 'function' ? row.params() : { ...row.params };
  if (!row.noProviderFilter) {
    params.with_watch_providers = provider.tmdbProviderId;
    params.with_watch_monetization_types = 'flatrate|ads';
  }
  const data = await discover(type, params, page);
  const metas = await mapLimit(data.results || [], 8, (item) =>
    toMetaPreview(item, type, row.shape).catch(() => null),
  );
  return { metas: metas.filter(Boolean), cacheMaxAge: 3 * 3600 };
}
