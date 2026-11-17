// "Recomendados para você": blocos infinitos montados a partir do que a pessoa assiste.
// Exemplo: assistiu um documentário policial -> "Para quem curte documentários de crime".
import { config } from './config.js';
import { cached, mapLimit } from './cache.js';
import { tmdb, discover, details, tmdbIdFromImdb, toMetaPreview, similarOnProvider, GENRE_PT } from './tmdb.js';

const HOUR = 3600_000;
const tmdbType = (type) => (type === 'movie' ? 'movie' : 'tv');
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// Nome amigável para uma combinação de gêneros.
const SHORT = { 'Ficção científica e fantasia': 'Ficção científica', 'Ação e aventura': 'Ação', 'Guerra e política': 'Guerra',
  'Ficção científica': 'Ficção científica', Documentario: 'Documentário' };
function comboLabel(names, type) {
  const [a, b] = names.map((n) => SHORT[n] || n);
  const kind = type === 'movie' ? 'filmes' : 'séries';
  if (!b) return `${a === 'Documentário' ? 'Documentários' : `${kind[0].toUpperCase()}${kind.slice(1)} de ${lower(a)}`}`;
  if (a === 'Documentário' || b === 'Documentário') return `Documentários de ${lower(a === 'Documentário' ? b : a)}`;
  if (a === 'Animação' || b === 'Animação') return `Animações de ${lower(a === 'Animação' ? b : a)}`;
  return `${kind[0].toUpperCase()}${kind.slice(1)} de ${lower(a)} e ${lower(b)}`;
}

async function seedInfo(seed) {
  return cached(`seed:${seed.type}:${seed.id}`, 24 * HOUR, async () => {
    const id = await tmdbIdFromImdb(seed.type, seed.id);
    if (!id) return null;
    const d = await details(seed.type, id);
    const genres = (d.genres || []).filter((g) => ![10767, 10763, 10766].includes(g.id)); // talk show, jornal, novela
    return {
      ...seed,
      tmdbId: id,
      name: d.title || d.name || seed.name,
      genres: genres.map((g) => ({ id: g.id, name: GENRE_PT[g.name] || g.name })),
    };
  });
}

// Lista de blocos possíveis para essas sementes (na ordem em que aparecem ao descer).
async function plan(seeds) {
  const infos = (await mapLimit(seeds.slice(0, 6), 4, (s) => seedInfo(s).catch(() => null))).filter(Boolean);
  const blocks = [{ kind: 'mix', title: 'Recomendados para você', seeds: infos.slice(0, 3) }];
  const usedCombos = new Set();
  for (const s of infos) {
    if (s.genres.length) {
      const pair = s.genres.slice(0, 2);
      const key = `${s.type}:${pair.map((g) => g.id).sort().join(',')}`;
      if (!usedCombos.has(key)) {
        usedCombos.add(key);
        blocks.push({ kind: 'combo', title: `Para quem curte ${lower(comboLabel(pair.map((g) => g.name), s.type))}`,
          type: s.type, genres: pair.map((g) => g.id).join(',') });
      }
    }
    blocks.push({ kind: 'similar', title: `Porque você assistiu ${s.name}`, seed: s });
  }
  // Gêneros soltos das sementes, depois o que está em alta.
  for (const s of infos) {
    for (const g of s.genres.slice(0, 2)) {
      const key = `${s.type}:${g.id}`;
      if (usedCombos.has(key)) continue;
      usedCombos.add(key);
      blocks.push({ kind: 'combo', title: comboLabel([g.name], s.type), type: s.type, genres: String(g.id) });
    }
  }
  blocks.push({ kind: 'trending', title: 'Séries em alta', type: 'series' });
  blocks.push({ kind: 'trending', title: 'Filmes em alta', type: 'movie' });
  blocks.push({ kind: 'acclaimed', title: 'Aclamados pela crítica', type: 'movie' });
  blocks.push({ kind: 'acclaimed', title: 'Séries aclamadas', type: 'series' });
  return blocks;
}

const onProvider = (provider) => ({
  with_watch_providers: provider.tmdbProviderId,
  with_watch_monetization_types: 'flatrate|ads',
});

async function discoverMetas(type, params, page) {
  const data = await discover(type, params, page).catch(() => ({ results: [] }));
  const metas = await mapLimit(data.results || [], 8, (x) => toMetaPreview(x, type, 'landscape').catch(() => null));
  return metas.filter((m) => m && m.background);
}

async function blockMetas(block, round, provider) {
  const page = round + 1;
  switch (block.kind) {
    case 'mix': {
      if (round > 0) return [];
      const lists = await Promise.all(block.seeds.map((s) =>
        similarOnProvider(s.type, s.id, provider.tmdbProviderId).catch(() => [])));
      const out = [];
      for (let i = 0; i < 18; i++) for (const l of lists) if (l[i]) out.push(l[i]);
      if (out.length >= 6) return out;
      const [a, b] = await Promise.all([
        discoverMetas('series', { sort_by: 'popularity.desc', ...onProvider(provider) }, 1),
        discoverMetas('movie', { sort_by: 'popularity.desc', ...onProvider(provider) }, 1),
      ]);
      return [...out, ...a.slice(0, 10), ...b.slice(0, 10)];
    }
    case 'similar':
      return round > 0 ? [] : similarOnProvider(block.seed.type, block.seed.id, provider.tmdbProviderId).catch(() => []);
    case 'combo':
      return discoverMetas(block.type, { sort_by: 'popularity.desc', with_genres: block.genres, 'vote_count.gte': 20, ...onProvider(provider) }, page);
    case 'trending':
      return discoverMetas(block.type, { sort_by: 'popularity.desc', ...onProvider(provider) }, page + 1);
    case 'acclaimed':
      return discoverMetas(block.type, { sort_by: 'vote_average.desc', 'vote_count.gte': 800, ...onProvider(provider) }, page);
    default:
      return [];
  }
}

// page 0, 1, 2...: percorre os blocos; quando acabam, recomeça na próxima página de cada um.
export function forYou(provider, seeds, pageIndex) {
  const key = `foryou:${provider.key}:${config.region}:${seeds.map((s) => s.id).join(',')}:${pageIndex}`;
  return cached(key, 3 * HOUR, async () => {
    const blocks = await plan(seeds);
    const block = blocks[pageIndex % blocks.length];
    const round = Math.floor(pageIndex / blocks.length);
    if (round > 4) return { done: true, title: '', metas: [] };
    const metas = await blockMetas(block, round, provider);
    const title = round === 0 ? block.title : `Mais: ${lower(block.title)}`;
    return { done: false, title, metas };
  });
}
