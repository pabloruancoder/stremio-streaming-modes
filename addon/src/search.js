// Busca no estilo Netflix: só devolve o que está no streaming da região.
// Junta três fontes: títulos com o nome buscado, gênero (ex.: "terror") e pessoas
// (ex.: "Adam Sandler" traz os filmes dele que estão na Netflix).
import { config } from './config.js';
import { cached, mapLimit } from './cache.js';
import { tmdb, discover, isOnProvider, toMetaPreview, similarOnProvider } from './tmdb.js';

const HOUR = 3600_000;

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Gêneros do TMDB (ids de filme / série) e os termos que as pessoas costumam digitar.
const GENRES = [
  { label: 'Terror', movie: 27, series: '9648,10765', terms: ['terror', 'horror', 'medo', 'assustador', 'filme de terror'] },
  { label: 'Ação', movie: 28, series: 10759, terms: ['acao', 'action', 'aventura', 'acao e aventura'] },
  { label: 'Comédia', movie: 35, series: 35, terms: ['comedia', 'comedy', 'engracado', 'humor'] },
  { label: 'Drama', movie: 18, series: 18, terms: ['drama'] },
  { label: 'Romance', movie: 10749, series: 10766, terms: ['romance', 'romantico', 'romanticos', 'amor'] },
  { label: 'Ficção científica', movie: 878, series: 10765, terms: ['ficcao', 'ficcao cientifica', 'sci fi', 'scifi'] },
  { label: 'Fantasia', movie: 14, series: 10765, terms: ['fantasia', 'fantasy'] },
  { label: 'Suspense', movie: 53, series: 9648, terms: ['suspense', 'thriller'] },
  { label: 'Policial', movie: 80, series: 80, terms: ['policial', 'crime', 'crimes', 'investigacao'] },
  { label: 'Documentários', movie: 99, series: 99, terms: ['documentario', 'documentarios', 'doc', 'docs'] },
  { label: 'Animação', movie: 16, series: 16, terms: ['animacao', 'desenho', 'desenhos', 'animados'] },
  { label: 'Anime', movie: 16, series: 16, lang: 'ja', terms: ['anime', 'animes'] },
  { label: 'Família', movie: 10751, series: 10751, terms: ['familia', 'infantil', 'kids', 'criancas'] },
  { label: 'Mistério', movie: 9648, series: 9648, terms: ['misterio'] },
  { label: 'Guerra', movie: 10752, series: 10768, terms: ['guerra', 'war'] },
  { label: 'Reality shows', movie: null, series: 10764, terms: ['reality', 'reality show', 'reality shows'] },
  { label: 'Faroeste', movie: 37, series: 37, terms: ['faroeste', 'western', 'velho oeste'] },
  { label: 'Musicais', movie: 10402, series: null, terms: ['musical', 'musicais', 'musica'] },
  { label: 'Brasileiros', movie: null, series: null, country: 'BR', terms: ['brasileiro', 'brasileiros', 'brasileira', 'brasileiras', 'nacional', 'nacionais'] },
];

// "terror", "filmes de terror", "Terror - séries"... -> { ...gênero, only: 'movie'|'series'|null }
function matchGenre(q) {
  let n = norm(q);
  let only = null;
  const lead = n.match(/^(filmes?|series?) (de |do |da )?/);
  const tail = n.match(/ (filmes?|series?)$/);
  const kind = (lead || tail)?.[1];
  if (kind) only = kind.startsWith('filme') ? 'movie' : 'series';
  n = n.replace(/^(filmes?|series?) (de |do |da )?/, '').replace(/ (filmes?|series?)$/, '');
  const g = GENRES.find((x) => x.terms.includes(n));
  return g ? { ...g, only } : null;
}

const keyOf = (type, id) => `${type}:${id}`;

async function genreResults(g, provider, pages = [1, 2]) {
  const base = {
    sort_by: 'popularity.desc',
    with_watch_providers: provider.tmdbProviderId,
    with_watch_monetization_types: 'flatrate|ads',
  };
  const jobs = [];
  for (const type of ['movie', 'series']) {
    if (g.only && g.only !== type) { pages.forEach(() => jobs.push(Promise.resolve([]))); continue; }
    const params = { ...base };
    if (g.country) params.with_origin_country = g.country;
    else if (g[type]) params.with_genres = g[type];
    else { pages.forEach(() => jobs.push(Promise.resolve([]))); continue; }
    if (g.lang) params.with_original_language = g.lang;
    for (const page of pages) {
      jobs.push(discover(type, params, page).then((d) => (d.results || []).map((x) => ({ x, type }))).catch(() => []));
    }
  }
  const lists = await Promise.all(jobs);
  // Intercala filmes e séries, mantendo a ordem de popularidade de cada um.
  const movies = lists.slice(0, lists.length / 2).flat();
  const series = lists.slice(lists.length / 2).flat();
  const out = [];
  for (let i = 0; i < Math.max(movies.length, series.length); i++) {
    if (movies[i]) out.push(movies[i]);
    if (series[i]) out.push(series[i]);
  }
  return out;
}

async function textResults(q, provider) {
  const [multi1, multi2] = await Promise.all(
    [1, 2].map((page) => tmdb('/search/multi', { query: q, include_adult: false, page }).catch(() => ({ results: [] }))),
  );
  const results = [...(multi1.results || []), ...(multi2.results || [])];
  const titles = [];
  const people = [];
  for (const r of results) {
    if (r.media_type === 'movie') titles.push({ x: r, type: 'movie' });
    else if (r.media_type === 'tv') titles.push({ x: r, type: 'series' });
    else if (r.media_type === 'person' && people.length < 2 && r.popularity > 3) people.push(r);
  }
  // Pessoa buscada pelo nome: traz os trabalhos dela (os mais populares primeiro).
  const target = norm(q);
  const personHits = [];
  for (const p of people.filter((p) => norm(p.name).includes(target) || target.includes(norm(p.name)))) {
    const credits = await tmdb(`/person/${p.id}/combined_credits`).catch(() => ({ cast: [], crew: [] }));
    const works = [...(credits.cast || []), ...(credits.crew || []).filter((c) => c.job === 'Director' || c.job === 'Creator')]
      .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
      .filter((c) => !(c.genre_ids || []).some((g) => g === 10767 || g === 10763)) // talk shows / jornalismo
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 40);
    for (const w of works) personHits.push({ x: w, type: w.media_type === 'movie' ? 'movie' : 'series' });
  }
  // Títulos cujo nome contém o termo vêm antes (como na Netflix).
  const exact = (t) => {
    const names = [t.x.title, t.x.name, t.x.original_title, t.x.original_name].map(norm);
    return names.some((n) => n === target) ? 2 : names.some((n) => n.includes(target)) ? 1 : 0;
  };
  titles.sort((a, b) => exact(b) - exact(a) || (b.x.popularity || 0) - (a.x.popularity || 0));
  return { titles, personHits, related: people.map((p) => p.name) };
}

// O TMDB devolve alguns gêneros de série em inglês mesmo em pt-BR.
const TV_GENRE_PT = {
  'Action & Adventure': 'Ação', 'Sci-Fi & Fantasy': 'Ficção científica', 'War & Politics': 'Guerra',
  Kids: 'Família', Reality: 'Reality shows', Talk: null, News: null, Soap: null,
};

// Termos relacionados mostrados no topo ("Explore títulos relacionados a: ...").
function relatedTerms(q, genre, metas, people) {
  const out = [];
  const push = (s) => s && !out.some((o) => norm(o) === norm(s)) && norm(s) !== norm(q) && out.push(s);
  if (genre) {
    push(genre.label);
    push(`${genre.label} - filmes`);
    push(`${genre.label} - séries`);
  }
  people.forEach(push);
  const counts = new Map();
  for (const m of metas.slice(0, 20)) {
    for (const raw of m.genres || []) {
      const g = TV_GENRE_PT[raw] ?? raw;
      if (g && matchGenre(g)) counts.set(g, (counts.get(g) || 0) + 1);
    }
  }
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([g]) => push(g));
  for (const m of metas.slice(0, 4)) push(m.name);
  return out.slice(0, 10);
}

// Sugestões da coluna da esquerda, que tentam adivinhar o que a pessoa quer enquanto digita.
function suggestionsFor(q, genre, metas, people) {
  const n = norm(q);
  const out = [];
  const push = (s) => s && !out.some((o) => norm(o) === norm(s)) && out.push(s);
  for (const g of GENRES) {
    if (norm(g.label).startsWith(n) || g.terms.some((t) => t.startsWith(n))) push(g.label);
  }
  if (genre) {
    push(`${genre.label} - filmes`);
    push(`${genre.label} - séries`);
  }
  people.forEach(push);
  for (const m of metas.slice(0, 12)) push(m.name);
  return out.slice(0, 12);
}

export function searchOnProvider(query, provider) {
  const q = String(query || '').trim().slice(0, 80);
  if (!q) return Promise.resolve({ query: q, related: [], suggestions: [], metas: [] });
  return cached(`search:${provider.key}:${config.region}:${norm(q)}`, 6 * HOUR, async () => {
    const genre = matchGenre(q);
    // Ainda digitando o nome de um gênero ("ter" -> Terror): adivinha e mistura o gênero nos resultados.
    const n = norm(q);
    const guess = !genre && n.length >= 3 ? GENRES.find((x) => x.terms.some((t) => t.startsWith(n))) : null;
    const [g, t] = await Promise.all([
      genre || guess ? genreResults(genre || guess, provider) : [],
      textResults(q, provider),
    ]);
    const nameHit = (x) => [x.title, x.name, x.original_title, x.original_name].some((v) =>
      norm(v).split(' ').some((w) => w.startsWith(n)) || norm(v).startsWith(n));
    // Gênero exato: o gênero manda. Palpite de gênero: títulos cujo nome bate, depois o gênero.
    // Senão: títulos pelo nome, depois trabalhos da pessoa.
    const ordered = genre
      ? [...g, ...t.titles]
      : guess
        ? [...t.titles.filter(({ x }) => nameHit(x)), ...g, ...t.titles.filter(({ x }) => !nameHit(x))]
        : [...t.titles, ...t.personHits];
    const seen = new Set();
    const pool = ordered.filter(({ x, type }) => {
      const k = keyOf(type, x.id);
      return !seen.has(k) && seen.add(k);
    }).slice(0, 90);

    // Resultados do gênero já vêm filtrados pelo streaming; os demais precisam ser conferidos.
    const fromGenre = new Set(g.map(({ x, type }) => keyOf(type, x.id)));
    const ok = await mapLimit(pool, 12, ({ x, type }) =>
      fromGenre.has(keyOf(type, x.id)) ? true : isOnProvider(type, x.id, provider.tmdbProviderId).catch(() => false),
    );
    const onIt = pool.filter((_, i) => ok[i]).slice(0, 60);
    const metas = (await mapLimit(onIt, 10, ({ x, type }) => toMetaPreview(x, type, 'landscape').catch(() => null)))
      .filter((m) => m && m.background); // sem imagem de fundo o card fica vazio
    // Poucos resultados pelo nome: completa com títulos parecidos com o primeiro (a Netflix faz o mesmo).
    if (!genre && !guess && metas.length && metas.length < 24) {
      const more = await similarOnProvider(metas[0].type, metas[0].id, provider.tmdbProviderId).catch(() => []);
      const ids = new Set(metas.map((m) => m.id));
      for (const m of more) if (!ids.has(m.id)) metas.push(m);
    }
    return {
      query: q,
      genre: genre?.label || null,
      related: relatedTerms(q, genre, metas, t.related),
      suggestions: suggestionsFor(q, genre || guess, metas, t.related),
      metas,
    };
  });
}

// Páginas seguintes da busca (rolagem infinita). page 1, 2, 3...
// Gênero: próximas páginas do gênero no streaming. Texto: próximas páginas da busca do TMDB, filtradas pelo streaming.
export function searchMore(query, provider, page) {
  const q = String(query || '').trim().slice(0, 80);
  if (!q || page < 1 || page > 15) return Promise.resolve({ metas: [], more: false });
  return cached(`searchmore:${provider.key}:${config.region}:${norm(q)}:${page}`, 6 * HOUR, async () => {
    const genre = matchGenre(q);
    const n = norm(q);
    const guess = !genre && n.length >= 3 ? GENRES.find((x) => x.terms.some((t) => t.startsWith(n))) : null;
    const g = genre || guess;
    let pool;
    if (g) {
      pool = await genreResults(g, provider, [page * 2 + 1, page * 2 + 2]);
    } else {
      const res = await Promise.all([page * 2 + 1, page * 2 + 2].map((pg) =>
        tmdb('/search/multi', { query: q, include_adult: false, page: pg }).catch(() => ({ results: [] }))));
      pool = res.flatMap((r) => r.results || [])
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map((r) => ({ x: r, type: r.media_type === 'movie' ? 'movie' : 'series' }));
      const ok = await mapLimit(pool, 12, ({ x, type }) => isOnProvider(type, x.id, provider.tmdbProviderId).catch(() => false));
      pool = pool.filter((_, i) => ok[i]);
    }
    const metas = (await mapLimit(pool, 10, ({ x, type }) => toMetaPreview(x, type, 'landscape').catch(() => null)))
      .filter((m) => m && m.background);
    return { metas, more: g ? pool.length > 0 : page < 6 };
  });
}
