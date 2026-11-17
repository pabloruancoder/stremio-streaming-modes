import { config, hasTmdb } from './config.js';
import { cached, mapLimit } from './cache.js';
import { tmdb, discover, toMetaPreview } from './tmdb.js';
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
  if (p.originalMovies) {
    rows.push({ id: 'originals-movies', type: 'movie', name: `Filmes originais ${p.label}`, kind: 'original-movies', shape: card });
  }
  rows.push(
    // "Em alta" fica curto; o catálogo inteiro está em "Todos os filmes" / "Todas as séries".
    { id: 'trending-series', type: 'series', name: 'Séries em alta', kind: 'discover', shape: card, limit: 200,
      params: { sort_by: 'popularity.desc' } },
    { id: 'trending-movies', type: 'movie', name: 'Filmes em alta', kind: 'discover', shape: card, limit: 200,
      params: { sort_by: 'popularity.desc' } },
    { id: 'new-movies', type: 'movie', name: 'Lançamentos', kind: 'fresh', shape: card, days: p.freshDays?.movie || 30 },
    { id: 'new-series', type: 'series', name: 'Séries novas', kind: 'fresh', shape: card, days: p.freshDays?.series || 60 },
    // Títulos que entraram na Netflix (inclusive filmes antigos licenciados agora). Calculado no build
    // estático comparando o catálogo completo com o da execução anterior; o servidor só repassa o arquivo.
    { id: 'recent-movies', type: 'movie', name: 'Filmes adicionados recentemente', kind: 'recent', shape: card },
    { id: 'recent-series', type: 'series', name: 'Séries adicionadas recentemente', kind: 'recent', shape: card },
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
  genre('br-movies', 'movie', 'Filmes brasileiros', { with_origin_country: 'BR' });
  genre('thriller-movies', 'movie', 'Filmes de suspense', { with_genres: 53 });
  genre('animation-movies', 'movie', 'Filmes de animação', { with_genres: 16 });
  genre('anime-movies', 'movie', 'Filmes de anime', { with_genres: 16, with_original_language: 'ja' });
  genre('war-movies', 'movie', 'Filmes de guerra e história', { with_genres: '10752|36' });
  genre('action-series', 'series', 'Séries de ação e aventura', { with_genres: 10759 });
  genre('comedy-series', 'series', 'Séries de comédia', { with_genres: 35 });
  genre('scifi-series', 'series', 'Séries de ficção científica e fantasia', { with_genres: 10765 });
  genre('mystery-series', 'series', 'Séries de mistério', { with_genres: 9648 });
  genre('docu-series', 'series', 'Séries documentais', { with_genres: 99 });
  genre('kdrama-series', 'series', 'Séries coreanas', { with_original_language: 'ko' });
  genre('spanish-series', 'series', 'Séries espanholas e latinas', { with_original_language: 'es' });
  // Catálogo inteiro da Netflix no Brasil, do mais popular ao menos popular.
  genre('all-movies', 'movie', 'Todos os filmes', {});
  genre('all-series', 'series', 'Todas as séries', {});
  // Páginas de marca (Disney+: Disney, Pixar, Marvel...): populares, lançamentos, mais bem avaliados e clássicos.
  const todayParam = (key) => () => ({ [key]: today() });
  for (const b of p.brands || []) {
    genre(`brand-${b.id}-movies`, 'movie', `${b.name}: filmes`, b.movie);
    genre(`brand-${b.id}-series`, 'series', `${b.name}: séries`, b.series);
    const dated = (id, type, name, params, dateKey) => rows.push({ id, type, name, kind: 'discover', shape: card,
      params: () => ({ ...params, ...todayParam(dateKey)() }) });
    dated(`brand-${b.id}-new`, 'movie', `${b.name}: lançamentos`, { ...b.movie, sort_by: 'primary_release_date.desc' }, 'primary_release_date.lte');
    dated(`brand-${b.id}-series-new`, 'series', `${b.name}: séries recentes`, { ...b.series, sort_by: 'first_air_date.desc' }, 'first_air_date.lte');
    genre(`brand-${b.id}-top`, 'movie', `${b.name}: mais bem avaliados`, { ...b.movie, sort_by: 'vote_average.desc', 'vote_count.gte': 300 });
    genre(`brand-${b.id}-classics`, 'movie', `${b.name}: clássicos`, { ...b.movie, 'primary_release_date.lte': '1999-12-31' });
  }
  // Fileiras infantis próprias do streaming (Disney+: filmes Disney/Pixar livres e Disney Channel/Junior).
  for (const k of p.kidsRows || []) genre(k.id, k.type, k.name, k.params);
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

// Filmes originais do streaming (o TMDB não marca "Original Disney+"): filmes dos estúdios, disponíveis no
// streaming, lançados depois da estreia do serviço e que não passaram nos cinemas dos EUA nem do país
// (estrearam direto no streaming ou na TV). Ex.: Abracadabra 2 e Pinóquio entram; Eternos (cinema) não.
function originalMovieList(provider) {
  const o = provider.originalMovies;
  return cached(`orig-movies:${provider.key}:${config.region}`, 6 * 3600_000, async () => {
    const params = { with_companies: o.companies, 'primary_release_date.gte': o.since, sort_by: 'popularity.desc',
      with_watch_providers: provider.tmdbProviderId, with_watch_monetization_types: 'flatrate|ads' };
    const items = await allPages('movie', params);
    const checks = await mapLimit(items, 8, async (x) => {
      const d = await tmdb(`/movie/${x.id}/release_dates`, { language: undefined }).catch(() => null);
      if (!d) return false;
      const types = (d.results || []).filter((r) => r.iso_3166_1 === 'US' || r.iso_3166_1 === config.region)
        .flatMap((r) => r.release_dates.map((rd) => rd.type));
      return types.length > 0 && !types.includes(3) && !types.includes(2); // 2 = cinema limitado, 3 = cinema
    });
    const keep = items.filter((_, i) => checks[i]);
    const metas = await mapLimit(keep, 8, (item) => toMetaPreview(item, 'movie', config.cardStyle).catch(() => null));
    const seen = new Set();
    return metas.filter((m) => m && !seen.has(m.id) && seen.add(m.id));
  });
}
const MAX_PAGES = 500; // limite do /discover do TMDB (10.000 títulos)

function discoverParams(provider, row) {
  const params = typeof row.params === 'function' ? row.params() : { ...row.params };
  if (!row.noProviderFilter) {
    params.with_watch_providers = provider.tmdbProviderId;
    params.with_watch_monetization_types = 'flatrate|ads';
  }
  return params;
}

// Fileiras calculadas só no build ("adicionados recentemente"): o servidor do PC lê a cópia do GitHub Pages.
// Lá cada arquivo tem 100 títulos (catalog/<tipo>/<id>.json, catalog/<tipo>/<id>/skip=100.json...).
async function publishedCatalog(type, id, skip) {
  const chunk = Math.floor(skip / 100) * 100;
  const url = `${config.pagesUrl}/catalog/${type}/${id}${chunk ? `/skip=${chunk}` : ''}.json`;
  const data = await cached(`published:${url}`, 3600_000, async () => {
    const res = await fetch(url);
    if (res.status === 404) return { metas: [] };
    if (!res.ok) throw new Error(`GitHub Pages ${res.status}`);
    return res.json();
  });
  return (data.metas || []).slice(skip - chunk);
}

// Todas as páginas do /discover (usado pelo build estático).
async function allPages(type, params, limit) {
  const first = await discover(type, params, 1);
  const cap = limit ? Math.ceil(limit / PAGE) + 1 : MAX_PAGES; // +1 página: alguns itens não têm IMDb
  const total = Math.min(first.total_pages || 1, cap);
  const rest = await mapLimit(Array.from({ length: total - 1 }, (_, i) => i + 2), 6, (p) =>
    discover(type, params, p).catch((err) => {
      console.warn(`  página ${p}: ${err.message}`);
      return { results: [] };
    }));
  return [first, ...rest].flatMap((d) => d.results || []);
}

// A fileira inteira, sem limite de páginas: o build estático grava tudo em arquivos de 100.
export async function fullCatalog(id) {
  const entry = index.get(id);
  if (!entry) return [];
  const { provider, row } = entry;
  if (row.kind === 'top10') return top10Metas(row.type, provider);
  if (row.kind === 'recent' || !hasTmdb()) return [];
  if (row.kind === 'original-movies') return originalMovieList(provider);
  let items = row.kind === 'fresh'
    ? localFirst(await allPages(row.type, freshParams(row.type, provider, row)))
    : await allPages(row.type, discoverParams(provider, row), row.limit);
  const seenTmdb = new Set();
  items = items.filter((x) => !seenTmdb.has(x.id) && seenTmdb.add(x.id));
  const metas = await mapLimit(items, 8, (item) => toMetaPreview(item, row.type, row.shape).catch(() => null));
  const seen = new Set();
  const list = metas.filter((m) => m && !seen.has(m.id) && seen.add(m.id));
  return row.limit ? list.slice(0, row.limit) : list;
}

export const catalogKind = (id) => index.get(id)?.row.kind;

// Estreias recentes no streaming. A popularidade do TMDB é mundial (um lançamento americano
// chega a 20x a de um documentário brasileiro que está bombando aqui), então as produções do
// país das últimas 3 semanas vêm primeiro e o resto segue por popularidade.
function freshParams(type, provider, row) {
  const since = new Date(Date.now() - row.days * 86400_000).toISOString().slice(0, 10);
  const dateKey = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  return {
    sort_by: 'popularity.desc',
    [`${dateKey}.gte`]: since,
    [`${dateKey}.lte`]: today(),
    with_watch_providers: provider.tmdbProviderId,
    with_watch_monetization_types: 'flatrate|ads',
  };
}

function localFirst(items) {
  const lang = config.language.slice(0, 2);
  const recent = new Date(Date.now() - 21 * 86400_000).toISOString().slice(0, 10);
  const isLocalNew = (x) =>
    (x.original_language === lang || (x.origin_country || []).includes(config.region)) &&
    (x.release_date || x.first_air_date || '') >= recent;
  return [...items.filter(isLocalNew), ...items.filter((x) => !isLocalNew(x))];
}

async function freshReleases(type, provider, row, part = 0) {
  const params = freshParams(type, provider, row);
  const pages = await Promise.all([part * 2 + 1, part * 2 + 2].map((p) => discover(type, params, p).catch(() => ({ results: [] }))));
  const all = pages.flatMap((p) => p.results || []);
  const ranked = part ? all : localFirst(all);
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

  if (row.kind === 'recent') return { metas: await publishedCatalog(type, id, skip), cacheMaxAge: 3600 };
  if (row.kind === 'original-movies') return { metas: (await originalMovieList(provider)).slice(skip, skip + 40), cacheMaxAge: 3 * 3600 };

  if (row.kind === 'fresh') {
    const part = Math.floor((skip + 20) / 40); // cada parte junta 2 páginas (40 títulos)
    if (part >= MAX_PAGES / 2) return { metas: [] };
    return { metas: await freshReleases(type, provider, row, part), cacheMaxAge: 3 * 3600 };
  }

  // Alguns itens são descartados por não terem IMDb id, então o "skip" do Stremio
  // fica um pouco abaixo de múltiplos de 20. Arredonda para a página certa.
  const page = Math.floor((skip + PAGE / 2) / PAGE) + 1;
  if (page > (row.limit ? Math.ceil(row.limit / PAGE) : MAX_PAGES)) return { metas: [] };
  const params = discoverParams(provider, row);
  const data = await discover(type, params, page);
  const metas = await mapLimit(data.results || [], 8, (item) =>
    toMetaPreview(item, type, row.shape).catch(() => null),
  );
  return { metas: metas.filter(Boolean), cacheMaxAge: 3 * 3600 };
}
