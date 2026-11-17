// Top 10 oficial da Netflix (https://www.netflix.com/tudum/top10).
// A Netflix publica toda semana um TSV público com o ranking de cada país.
import { config, hasTmdb } from './config.js';
import { cached, mapLimit } from './cache.js';
import { search, details, isOnProvider, toMetaPreview } from './tmdb.js';

const TSV_URL = 'https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv';
const HOUR = 3600_000;

// Retorna { week, Films: [titulo...], TV: [titulo...] } da semana mais recente do país.
// O ranking oficial conta cada temporada separado (ex.: Lupin partes 1-4); juntamos numa
// entrada só e completamos até 10 com a semana anterior.
function loadCountryRanking() {
  return cached(`top10:tsv:${config.region}`, 6 * HOUR, async () => {
    const res = await fetch(TSV_URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`Top 10 Netflix: HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split('\n');
    const header = lines[0].split('\t');
    const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
    const byWeek = new Map();
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split('\t');
      if (c[col.country_iso2] !== config.region) continue;
      const w = c[col.week];
      if (!byWeek.has(w)) byWeek.set(w, []);
      byWeek.get(w).push({ category: c[col.category], rank: Number(c[col.weekly_rank]), title: c[col.show_title] });
    }
    const weeks = [...byWeek.keys()].sort().reverse();
    const pick = (category) => {
      const seen = new Set();
      const out = [];
      for (const w of weeks.slice(0, 2)) {
        const ranked = byWeek.get(w).filter((r) => r.category === category).sort((a, b) => a.rank - b.rank);
        for (const r of ranked) {
          if (out.length >= 10) break;
          if (!seen.has(r.title)) {
            seen.add(r.title);
            out.push(r.title);
          }
        }
      }
      return out;
    };
    return { week: weeks[0], Films: pick('Films'), TV: pick('TV') };
  });
}

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Encontra o título certo no TMDB. O ranking traz o nome em inglês, e nomes como
// "Heist" ou "My Best Friend" são ambíguos. Pontuação: título exato > está na Netflix
// da região > lançamento mais recente (o Top 10 é dominado por lançamentos).
async function resolveWithTmdb(title, type, provider) {
  const { results = [] } = await search(type, title, 'en-US');
  const target = norm(title);
  const scored = await Promise.all(
    results.slice(0, 6).map(async (c) => {
      const exact =
        norm(c.title || c.name) === target || norm(c.original_title || c.original_name) === target;
      const on = await isOnProvider(type, c.id, provider.tmdbProviderId).catch(() => false);
      const year = Number((c.release_date || c.first_air_date || '').slice(0, 4)) || 0;
      return { c, score: (exact ? 1000 : 0) + (on ? 500 : 0) + year / 10 };
    }),
  );
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.c;
  return best ? details(type, best.id) : null; // detalhes em pt-BR
}

// Sem chave do TMDB: usa a busca do Cinemeta (catálogo oficial do Stremio).
async function resolveWithCinemeta(title, type) {
  const url = `https://v3-cinemeta.strem.io/catalog/${type}/top/search=${encodeURIComponent(title)}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const { metas = [] } = await res.json();
  const m = metas[0];
  if (!m) return null;
  return {
    id: m.imdb_id || m.id,
    type,
    name: m.name,
    poster: m.poster,
    posterShape: 'poster',
    background: m.background,
    logo: m.logo,
    description: m.description,
    releaseInfo: m.releaseInfo,
  };
}

export function top10Metas(type, provider) {
  const category = type === 'movie' ? 'Films' : 'TV';
  return cached(`top10:metas:${config.region}:${type}:${hasTmdb()}`, 6 * HOUR, async () => {
    const ranking = await loadCountryRanking();
    const titles = ranking[category].slice(0, 10);
    const metas = await mapLimit(titles, 4, async (title) => {
      try {
        if (hasTmdb()) {
          const item = await resolveWithTmdb(title, type, provider);
          return item ? await toMetaPreview(item, type, 'poster') : null;
        }
        return await resolveWithCinemeta(title, type);
      } catch (err) {
        console.warn(`[top10] falha ao resolver "${title}": ${err.message}`);
        return null;
      }
    });
    return metas.filter(Boolean);
  });
}
