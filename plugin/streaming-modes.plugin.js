/**
 * @name Streaming Modes
 * @description Transforma o Stremio no visual e nas recomendações de um streaming (Netflix primeiro). Alt+M abre o seletor de modo.
 * @version 0.2.0
 * @author Tec-Projetos
 * @updateUrl none
 */
(() => {
  'use strict';
  if (window.__streamingModesLoaded) return;
  window.__streamingModesLoaded = true;

  // ===========================================================================
  // Configuração dos modos
  // ===========================================================================
  // `prefix` precisa bater com o nome das fileiras do addon ("Netflix • ...").
  // `rows` define a ordem da Home; ids especiais: @continue, @mylist, @because0, @because1.
  const MODES = {
    stremio: { key: 'stremio', label: 'Stremio padrão', accent: '#7b5bf5', splash: 'STREMIO' },
    netflix: {
      key: 'netflix',
      label: 'Netflix',
      accent: '#e50914',
      splash: 'NETFLIX',
      // Vinheta oficial, tocada pelo player incorporado do YouTube (canal oficial da Netflix, 4 s).
      introVideo: 'GV3HUDMQ-F8',
      wordmark: 'STREMIO',
      provider: 'netflix',
      prefix: 'Netflix • ',
      heroCatalogs: [
        { type: 'series', id: 'netflix.top10-series', label: 'em séries esta semana' },
        { type: 'movie', id: 'netflix.top10-movies', label: 'em filmes esta semana' },
      ],
      pages: {
        home: ['@continue', 'top10-series', 'new-movies', '@because0', '@soon', 'originals', 'trending-series', '@mylist',
          'top10-movies', '@because1', 'trending-movies', 'new-series', 'acclaimed-series', 'acclaimed-movies',
          'br-series', 'action-movies', 'comedy-movies', 'drama-series', 'crime-series', 'horror-movies',
          'scifi-movies', 'anime-series', 'romance-movies', 'kids-movies', 'reality-series', 'docs'],
        series: ['@continue', 'top10-series', '@because0', 'originals', 'trending-series', 'new-series',
          'acclaimed-series', 'br-series', 'drama-series', 'crime-series', 'anime-series', 'reality-series'],
        movies: ['@continue', 'top10-movies', '@because1', 'new-movies', 'trending-movies', 'acclaimed-movies',
          'action-movies', 'comedy-movies', 'horror-movies', 'scifi-movies', 'romance-movies', 'kids-movies', 'docs'],
        new: ['top10-series', 'top10-movies', 'new-movies', 'new-series', 'trending-series', 'trending-movies'],
      },
      // Perfil Infantil: só fileiras feitas para crianças (o tipo da página filtra filmes/séries).
      kidsPages: ['@continue', 'kids-anim-movies', 'kids-series', '@because0', 'kids-movies', 'kids-family-series', '@mylist'],
      kidsHero: [
        { type: 'movie', id: 'netflix.kids-anim-movies' },
        { type: 'series', id: 'netflix.kids-series' },
      ],
    },
  };
  const NAV_PAGES = [
    ['home', 'Início'],
    ['series', 'Séries'],
    ['movies', 'Filmes'],
    ['new', 'Novidades e populares'],
    ['mylist', 'Minha lista'],
  ];

  // remoteAddonUrl: cópia estática do addon no GitHub Pages, usada quando o addon do PC está desligado.
  const DEFAULTS = { mode: 'stremio', addonUrl: 'http://127.0.0.1:7100', showInDefault: false, muted: true,
    remoteAddonUrl: 'https://pabloruancoder.github.io/stremio-streaming-modes' };

  // ===========================================================================
  // Utilidades
  // ===========================================================================
  const store = {
    get(key) {
      try {
        const v = localStorage.getItem(`streamingModes.${key}`);
        return v === null ? DEFAULTS[key] : JSON.parse(v);
      } catch {
        return DEFAULTS[key];
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`streamingModes.${key}`, JSON.stringify(value));
      } catch {
        /* ignora */
      }
    },
  };

  // Cria elementos sem innerHTML (os dados vêm de fora e nunca viram HTML).
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return el;
  }

  // Ícones fixos (SVG estático, sem dados externos).
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICONS = {
    play: 'M6 4v16a1 1 0 0 0 1.52.85l13-8a1 1 0 0 0 0-1.7l-13-8A1 1 0 0 0 6 4z',
    plus: 'M12 5v14M5 12h14',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    down: 'M6 9l6 6 6-6',
    left: 'M15 5l-7 7 7 7',
    right: 'M9 5l7 7-7 7',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-5M12 8h.01',
    close: 'M6 6l12 12M18 6L6 18',
    up: 'M6 15l6-6 6 6',
    thumb: 'M7 22V11M7 11l4-9a3 3 0 0 1 3 3v4h5.3a2 2 0 0 1 2 2.3l-1.4 9A2 2 0 0 1 17.9 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3',
    pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    swap: 'M7 7h13l-4-4M17 17H4l4 4',
    library: 'M4 4v16M9 4v16M14 4l5 16',
    puzzle: 'M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    mute: 'M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6',
    sound: 'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  };
  function icon(name, filled = false) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'sm-ico');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', ICONS[name]);
    if (filled) p.setAttribute('fill', 'currentColor');
    else {
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', 'currentColor');
      p.setAttribute('stroke-width', '2.2');
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
    }
    svg.appendChild(p);
    return svg;
  }

  const isBoardRoute = () => /^(#\/?)?$/.test(location.hash);
  // Texto buscado quando a rota é a busca do Stremio (#/search?search=...); null fora dela.
  const searchQuery = () => {
    const m = location.hash.match(/^#\/search(?:\?(.*))?$/);
    return m ? new URLSearchParams(m[1] || '').get('search') ?? '' : null;
  };
  const isAppRoute = () => isBoardRoute() || searchQuery() !== null;
  const cssUrl = (u) => `url("${String(u).replace(/["\\\n]/g, '')}")`;
  const tmdbSize = (u, size) => (u && u.includes('image.tmdb.org') ? u.replace(/\/t\/p\/[^/]+\//, `/t/p/${size}/`) : u);
  const metahub = (kind, id) => `https://images.metahub.space/${kind}/medium/${id}/img`;

  // ===========================================================================
  // Estado
  // ===========================================================================
  const state = {
    mode: MODES[store.get('mode')] ? store.get('mode') : 'stremio',
    addonUrl: store.get('addonUrl'),
    showInDefault: store.get('showInDefault'),
    muted: store.get('muted'),
    page: 'home',
    transitioning: false,
  };

  // ===========================================================================
  // Dados: addon + biblioteca do Stremio
  // ===========================================================================
  const requests = new Map();
  function getJSON(url) {
    if (!requests.has(url)) {
      const p = fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .catch((e) => {
          requests.delete(url);
          throw e;
        });
      requests.set(url, p);
    }
    return requests.get(url);
  }
  // API_V muda quando o formato das respostas muda, para não usar o cache antigo do navegador.
  const API_V = 2;
  // Addon do PC desligado: fileiras, Top 10 e estreias vêm da cópia no GitHub Pages (arquivos estáticos).
  // Busca, recomendações personalizadas, trailers e dados do player precisam do addon do PC.
  let localDownAt = 0;
  const localDown = () => Date.now() - localDownAt < 60_000; // tenta o PC de novo a cada minuto
  const STATIC_PATH = /^\/(manifest\.json|catalog\/(movie|series)\/[^/]+\.json|sm\/upcoming\/[a-z]+\.json)$/;
  function addon(path) {
    const bare = path.split('?')[0];
    const remote = () => getJSON(`${store.get('remoteAddonUrl')}${bare}`);
    const canRemote = STATIC_PATH.test(bare) && store.get('remoteAddonUrl');
    if (canRemote && localDown()) return remote();
    return getJSON(`${state.addonUrl}${path}${path.includes('?') ? '&' : '?'}v=${API_V}`).catch((err) => {
      if (!canRemote) throw err;
      localDownAt = Date.now();
      return remote();
    });
  }
  const offlineText = () => (localDown()
    ? 'Esta parte precisa do addon do PC ligado (abra o iniciar-stremio.bat). As fileiras continuam vindo do GitHub.'
    : `Não consegui falar com o addon em ${state.addonUrl}. Ele está rodando? Abra o iniciar-stremio.bat.`);
  const catalog = (type, id) => addon(`/catalog/${type}/${encodeURIComponent(id)}.json`).then((d) => d.metas || []);
  const manifest = () => addon('/manifest.json');
  const details = (type, id) => addon(`/sm/details/${type}/${id}.json`).then((d) => d.details).catch(() => null);
  const season = (id, n) => addon(`/sm/season/${id}/${n}.json`).then((d) => d.episodes || []).catch(() => []);
  const similar = (provider, type, id) =>
    addon(`/sm/similar/${provider}/${type}/${id}.json`).then((d) => d.metas || []).catch(() => []);

  // ===========================================================================
  // Perfis ("Quem está assistindo?"), histórico por perfil e avaliações
  // ===========================================================================
  const AVATARS = [
    { e: '😀', c: ['#e50914', '#7a0a0f'] }, { e: '😎', c: ['#1f6feb', '#0b2a66'] }, { e: '🐼', c: ['#2ea043', '#0d3b1a'] },
    { e: '🦊', c: ['#f0883e', '#7a3300'] }, { e: '🐱', c: ['#a371f7', '#3c1a78'] }, { e: '🐶', c: ['#d29922', '#5c3d00'] },
    { e: '🦁', c: ['#e3b341', '#6b4a00'] }, { e: '🐸', c: ['#3fb950', '#114d1d'] }, { e: '🤖', c: ['#6e7681', '#22272e'] },
    { e: '👾', c: ['#db61a2', '#5c1440'] }, { e: '🐙', c: ['#ff7b72', '#6e1a14'] }, { e: '🦄', c: ['#bc8cff', '#4b2c84'] },
    { e: '🧸', c: ['#ffb347', '#ff5e7e'] }, { e: '🚀', c: ['#39c5cf', '#0b4a56'] },
  ];
  const KIDS_GENRES = new Set(['Animação', 'Família', 'Infantil', 'Kids']);

  function stremioName() {
    try {
      const prof = JSON.parse(localStorage.getItem('profile') || '{}');
      const n = prof?.auth?.user?.fullname;
      return n ? String(n).trim().split(/\s+/)[0] : '';
    } catch { return ''; }
  }
  function profiles() {
    let list = store.get('profiles');
    if (!Array.isArray(list) || !list.length) {
      list = [
        { id: 'main', name: stremioName() || 'Você', avatar: 0, kids: false, main: true },
        { id: 'kids', name: 'Infantil', avatar: 12, kids: true },
      ];
      store.set('profiles', list);
    }
    return list;
  }
  const activeProfile = () => profiles().find((p) => p.id === store.get('activeProfile')) || profiles()[0];
  const isKids = () => Boolean(activeProfile().kids);
  const pkey = (name, p = activeProfile()) => `${name}:${p.id}`;

  // Histórico: o que cada perfil abriu para assistir pelo plugin.
  const historyOf = (p) => store.get(pkey('history', p)) || [];
  function recordHistory(item) {
    if (!item?.id) return;
    const p = activeProfile();
    const list = historyOf(p).filter((h0) => h0.id !== item.id);
    list.unshift({ id: item.id, type: item.type, name: item.name, at: Date.now() });
    store.set(pkey('history', p), list.slice(0, 300));
  }
  // O que pertence ao perfil ativo dentro da biblioteca do Stremio (que é uma só para a conta).
  function ownsLibraryItem(id) {
    const p = activeProfile();
    if (historyOf(p).some((h0) => h0.id === id)) return true;
    if (!p.main) return false;
    // Perfil principal: tudo, menos o que só os outros perfis assistiram.
    return !profiles().some((o) => !o.main && historyOf(o).some((h0) => h0.id === id));
  }

  // Avaliações: -1 = Não é pra mim, 1 = Gostei, 2 = Amei!
  const ratings = () => store.get(pkey('ratings')) || {};
  const ratingOf = (id) => ratings()[id]?.r || 0;
  function rate(item, r) {
    const all = ratings();
    if (all[item.id]?.r === r) delete all[item.id];
    else all[item.id] = { r, type: item.type, name: item.name, at: Date.now() };
    store.set(pkey('ratings'), all);
  }

  // Filtro comum das listas: tira o que o perfil marcou como "Não é pra mim" e, no Infantil, o que não é infantil.
  function profileFilter(list, { keepDisliked = false } = {}) {
    const r = ratings();
    const kids = isKids();
    return (list || []).filter((m) => m && (keepDisliked || r[m.id]?.r !== -1) &&
      (!kids || m.fromLib || (m.genres || []).some((g) => KIDS_GENRES.has(g))));
  }

  // Bases das recomendações: o que você amou, o que assistiu por último e o que gostou (nunca o que não curtiu).
  function profileSeeds() {
    const r = ratings();
    const pick = (val, src) => Object.entries(r).filter(([, v]) => v.r === val)
      .sort((a, b) => b[1].at - a[1].at).map(([id, v]) => ({ _id: id, type: v.type, name: v.name, src }));
    const watched = recentlyWatched().map((it) => ({ _id: it._id, type: it.type, name: it.name, src: 'watched' }));
    const seen = new Set();
    return [...pick(2, 'loved'), ...watched, ...pick(1, 'liked')]
      .filter((s0) => /^tt\d+$/.test(s0._id) && (s0.type === 'movie' || s0.type === 'series') && r[s0._id]?.r !== -1 &&
        !seen.has(s0._id) && seen.add(s0._id));
  }
  const seedsParam = () => profileSeeds().slice(0, 6).map((s0) => `${s0._id}:${s0.type}`).join(',');

  function libraryItems() {
    const out = new Map();
    for (const key of ['library', 'library_recent']) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        for (const it of Object.values(data.items || {})) {
          const prev = out.get(it._id);
          if (!prev || (it._mtime || '') > (prev._mtime || '')) out.set(it._id, it);
        }
      } catch {
        /* ignora */
      }
    }
    return [...out.values()].filter((it) => it.type === 'movie' || it.type === 'series');
  }
  // Mesma regra do Stremio (stremio-core): (!removed || temp) && timeOffset > 0
  const continueWatching = () =>
    libraryItems()
      .filter((it) => (!it.removed || it.temp) && it.state?.timeOffset > 0 && ownsLibraryItem(it._id))
      .sort((a, b) => (b.state.lastWatched || '').localeCompare(a.state.lastWatched || ''))
      .slice(0, 20);
  // Séries cujo último episódio foi terminado há pouco (o Stremio zera o progresso ao terminar).
  const finishedEpisodes = () => {
    const since = new Date(Date.now() - 45 * 86400_000).toISOString();
    return libraryItems().filter((it) => it.type === 'series' && (!it.removed || it.temp) && !(it.state?.timeOffset > 0) &&
      /^tt\d+:\d+:\d+$/.test(it.state?.video_id || '') && (it.state?.lastWatched || '') > since && it.state?.timeWatched > 60000 &&
      ownsLibraryItem(it._id));
  };
  const epLabel = (videoId) => {
    const m = String(videoId || '').match(/:(\d+):(\d+)$/);
    return m ? `T${m[1]}:E${m[2]}` : '';
  };

  // Continuar assistindo como na Netflix: episódio quase terminado (ou terminado) vira o próximo episódio.
  async function continueRow(typeFilter) {
    const base = continueWatching().map((it) => ({ lib: it, item: fromLibrary(it) }));
    const done = finishedEpisodes().map((it) => ({ lib: it, item: { ...fromLibrary(it), progress: 1 } }));
    const all = [...base, ...done]
      .filter(({ item }) => !typeFilter || item.type === typeFilter)
      .sort((a, b) => (b.lib.state.lastWatched || '').localeCompare(a.lib.state.lastWatched || ''));
    const out = await Promise.all(all.map(async ({ item }) => {
      if (item.type !== 'series') return item;
      const m = String(item.videoId || '').match(/^(tt\d+):(\d+):(\d+)$/);
      if (!m) return item;
      if (item.progress < 0.92) return { ...item, epLabel: epLabel(item.videoId) };
      const data = await addon(`/sm/next/${m[1]}/${m[2]}/${m[3]}.json`).catch(() => null);
      const next = data?.next;
      if (!next) return null; // série terminada (ou próximo episódio ainda não saiu)
      return { ...item, videoId: next.id, progress: 0, epLabel: `Próximo: T${next.season}:E${next.episode}` };
    }));
    const seen = new Set();
    return out.filter((it) => it && !seen.has(it.id) && seen.add(it.id)).slice(0, 20);
  }
  // Minha lista: o perfil principal usa a biblioteca do Stremio; os outros, uma lista própria.
  const myList = () => {
    const p = activeProfile();
    if (!p.main) return (store.get(pkey('list')) || []).slice().sort((a, b) => (b._mtime || '').localeCompare(a._mtime || ''));
    return libraryItems()
      .filter((it) => !it.removed && !it.temp)
      .sort((a, b) => (b._mtime || '').localeCompare(a._mtime || ''));
  };
  const recentlyWatched = () =>
    libraryItems()
      .filter((it) => it.state?.lastWatched && (it.state.timeWatched > 0 || it.state.timeOffset > 0) && ownsLibraryItem(it._id))
      .sort((a, b) => b.state.lastWatched.localeCompare(a.state.lastWatched));
  const inMyList = (id) => myList().some((it) => it._id === id);

  // Converte item da biblioteca do Stremio no formato de card.
  const fromLibrary = (it) => ({
    id: it._id,
    type: it.type,
    name: it.name,
    background: metahub('background', it._id),
    poster: it.poster,
    logo: metahub('logo', it._id),
    progress: it.state?.duration ? Math.min(1, it.state.timeOffset / it.state.duration) : 0,
    videoId: it.state?.video_id || null,
    fromLib: true,
  });

  function toggleMyList(item) {
    if (!activeProfile().main) {
      const key = pkey('list');
      const list = store.get(key) || [];
      const has = list.some((x) => x._id === item.id);
      store.set(key, has ? list.filter((x) => x._id !== item.id)
        : [{ _id: item.id, type: item.type, name: item.name, poster: item.poster || null, _mtime: new Date().toISOString() }, ...list].slice(0, 300));
      return !has;
    }
    const core = window.core;
    if (!core?.dispatch) return false;
    if (inMyList(item.id)) {
      core.dispatch({ action: 'Ctx', args: { action: 'RemoveFromLibrary', args: item.id } });
      return false;
    }
    core.dispatch({
      action: 'Ctx',
      args: {
        action: 'AddToLibrary',
        args: { id: item.id, type: item.type, name: item.name, poster: item.poster || null, posterShape: 'poster' },
      },
    });
    return true;
  }

  // O Stremio insere uma página intermediária (detalhes sem episódio) no histórico.
  // Ao voltar de um título aberto pelo modo streaming, pula essa página e volta direto para a Home.
  let playedId = null;
  window.addEventListener('popstate', () => {
    if (!playedId || !MODES[state.mode].provider) return;
    const id = playedId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^#/detail/[a-z]+/${id}(\\?.*)?$`).test(location.hash)) history.back();
    else if (isBoardRoute()) playedId = null;
  });

  function play(item) {
    noteInterest(item);
    recordHistory(item);
    closeModal();
    hidePreview();
    collapseCard();
    playedId = item.id;
    if (item.type === 'movie') location.hash = `#/detail/movie/${item.id}/${item.id}`;
    else {
      const lib = libraryItems().find((x) => x._id === item.id);
      const vid = item.videoId || lib?.state?.video_id || `${item.id}:1:1`;
      location.hash = `#/detail/series/${item.id}/${encodeURIComponent(vid)}`;
    }
  }

  // ===========================================================================
  // CSS
  // ===========================================================================
  const CSS = `
  /* ---------- Seletor de modo ---------- */
  .sm-switch { display:flex; align-items:center; gap:.5rem; height:2.4rem; padding:0 .9rem; margin-right:.5rem;
    border-radius:999px; border:1px solid rgba(255,255,255,.18); background:rgba(0,0,0,.35); color:#fff;
    font:600 .9rem/1 system-ui, sans-serif; cursor:pointer; white-space:nowrap; }
  .sm-switch:hover { background:rgba(255,255,255,.12); }
  .sm-switch .sm-dot { width:.55rem; height:.55rem; border-radius:50%; background:var(--sm-accent); box-shadow:0 0 8px var(--sm-accent); }
  .sm-switch .sm-ico { width:.8rem; height:.8rem; opacity:.75; }
  .sm-menu { position:fixed; z-index:100002; min-width:15rem; padding:.4rem; border-radius:.5rem; background:rgba(20,20,20,.97);
    border:1px solid rgba(255,255,255,.14); box-shadow:0 18px 50px rgba(0,0,0,.7); color:#eee; font:500 .92rem system-ui, sans-serif; }
  .sm-menu h4 { margin:.4rem .6rem .5rem; font-size:.7rem; letter-spacing:.08em; text-transform:uppercase; opacity:.55; }
  .sm-item { display:flex; align-items:center; gap:.7rem; width:100%; padding:.6rem .7rem; border:0; border-radius:.35rem;
    background:none; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .sm-item:hover, .sm-item:focus-visible { background:rgba(255,255,255,.08); outline:none; }
  .sm-item .sm-dot { width:.65rem; height:.65rem; border-radius:50%; flex:none; }
  .sm-item .sm-check { margin-left:auto; }
  .sm-sep { height:1px; margin:.4rem .3rem; background:rgba(255,255,255,.1); }
  .sm-field { display:block; padding:.4rem .7rem .6rem; font-size:.76rem; opacity:.85; }
  .sm-field input { display:block; width:100%; margin-top:.35rem; padding:.45rem .55rem; border-radius:.3rem;
    border:1px solid rgba(255,255,255,.15); background:#0b0b0b; color:#fff; font:inherit; font-size:.85rem; }
  .sm-toggle { display:flex; align-items:center; gap:.5rem; padding:.45rem .7rem; font-size:.8rem; cursor:pointer; opacity:.85; }
  .sm-hint { padding:.2rem .7rem .4rem; font-size:.7rem; opacity:.45; }

  /* ---------- Transição ---------- */
  /* Transição simples */
  .sm-intro { position:fixed; inset:0; z-index:100003; display:grid; place-items:center; pointer-events:none; background:#000;
    opacity:0; animation:sm-intro-bg var(--t, 1.5s) linear forwards; }
  @keyframes sm-intro-bg { 0% { opacity:0; } 15% { opacity:1; } 80% { opacity:1; } 100% { opacity:0; } }
  .sm-intro-word { font:400 clamp(4rem, 13vw, 11rem)/1 "Bebas Neue", Impact, "Arial Black", sans-serif; letter-spacing:.015em;
    color:var(--sm-accent); opacity:0; animation:sm-intro-word var(--t, 1.5s) ease-out forwards; }
  @keyframes sm-intro-word { 0%, 10% { opacity:0; transform:scale(.96); } 35% { opacity:1; transform:scale(1); }
    75% { opacity:1; transform:scale(1.03); } 100% { opacity:0; transform:scale(1.05); } }

  /* Vinheta em vídeo: preenche a tela e esconde as bordas do player */
  .sm-intro-video iframe { position:absolute; left:50%; top:50%; width:max(100vw, 177.78vh); height:max(56.25vw, 100vh); border:0;
    transform:translate(-50%, -50%) scale(1.18); opacity:0; transition:opacity .3s ease; }
  .sm-intro-video.playing iframe { opacity:1; }
  .sm-intro-video video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; background:#000; opacity:0; transition:opacity .25s ease; }
  .sm-intro-video.playing video { opacity:1; }
  /* Esconde o botão de pausa que o YouTube desenha no centro do player */
  .sm-intro-hide { position:absolute; left:50%; top:50%; z-index:2; width:180px; height:180px; margin:-90px 0 0 -90px; border-radius:50%;
    backdrop-filter:blur(32px) brightness(.62); -webkit-backdrop-filter:blur(32px) brightness(.62);
    mask-image:radial-gradient(closest-side, #000 50%, transparent); -webkit-mask-image:radial-gradient(closest-side, #000 50%, transparent); }
  .sm-intro-video { position:fixed; inset:0; z-index:100003; overflow:hidden; pointer-events:none; background:#000;
    animation:sm-iv-in .2s ease-out; transition:opacity .5s ease; }
  .sm-intro-video.out { opacity:0; }
  @keyframes sm-iv-in { from { opacity:0; } }
  @media (prefers-reduced-motion: reduce) { .sm-intro, .sm-intro * { --t:.6s; } }

  /* ---------- Modo padrão: esconde as fileiras dos streamings ---------- */
  html[data-sm-mode="stremio"]:not([data-sm-show-default]) [data-board-row][data-sm-streamer]:not([data-sm-streamer=""]) { display:none !important; }

  /* ---------- Modo Netflix: páginas do Stremio (detalhes, player, busca) em preto e vermelho ---------- */
  html[data-sm-mode="netflix"] {
    --background-color-primary:#141414; --background-color-secondary:#262626; --modal-background-color:#181818;
    --accent-color:#e50914; --accent-background-color:#e50914; --accent-foreground-color:#fff;
    --foreground-color-secondary:#b3b3b3; --surface-background-color:rgba(255,255,255,.06);
    --overlay-background-color:rgba(0,0,0,.6); --modal-backdrop-color:rgba(0,0,0,.7); --drop-shadow-color:#000;
    --filters-color:#e50914; --outer-glow:0 0 15px rgba(229,9,20,.35);
    /* nomes antigos (Stremio Web 5.x) */
    --primary-background-color:#141414; --secondary-background-color:#181818; --primary-accent-color:#e50914;
    --overlay-color:rgba(255,255,255,.06);
  }
  html[data-sm-mode="netflix"] body { background:#141414 !important; }

  /* ---------- Player no estilo Netflix ---------- */
  html[data-sm-mode="netflix"] [class*="control-bar-container"] { background:linear-gradient(0deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.4) 60%, transparent 100%) !important; }
  /* No Stremio: track = fundo, track-before = trecho já carregado, track-after = parte assistida */
  html[data-sm-mode="netflix"] [class*="seek-bar-container"] [class*="track-after"] { background-color:#e50914 !important; }
  html[data-sm-mode="netflix"] [class*="seek-bar-container"] [class*="track-before"] { background-color:rgba(255,255,255,.35) !important; }
  html[data-sm-mode="netflix"] [class*="seek-bar-container"] [class*="track-"]:not([class*="track-before"]):not([class*="track-after"]) { background-color:rgba(255,255,255,.18) !important; opacity:1 !important; }
  html[data-sm-mode="netflix"] [class*="seek-bar-container"] [class*="thumb-"] { background:#e50914 !important; box-shadow:0 0 0 3px rgba(229,9,20,.25) !important; }
  html[data-sm-mode="netflix"] [class*="volume-slider"] [class*="track-after"] { background-color:#fff !important; }
  html[data-sm-mode="netflix"] [class*="volume-slider"] [class*="thumb-"] { background:#fff !important; }
  /* Só os botões (o nome "control-bar-buttons-container" também contém "control-bar-button", por isso o hífen no fim) */
  html[data-sm-mode="netflix"] [class*="control-bar-button-"] svg,
  html[data-sm-mode="netflix"] [class*="player-nav"] svg { color:#fff !important; }
  html[data-sm-mode="netflix"] [class*="control-bar-button-"] { opacity:.88; transition:opacity .15s; }
  html[data-sm-mode="netflix"] [class*="control-bar-button-"]:hover { opacity:1; }
  html[data-sm-mode="netflix"] [class*="player-title"] { font-weight:700 !important; font-size:1.05rem !important; }
  /* A janela "próximo vídeo" do Stremio é substituída pelo cartão abaixo */
  html[data-sm-mode="netflix"] [class*="next-video-popup"] { display:none !important; }

  #sm-player { position:fixed; inset:0; z-index:9800; pointer-events:none; font-family:"Netflix Sans","Helvetica Neue",Helvetica,Arial,sans-serif; }
  #sm-player > * { pointer-events:auto; }
  .sm-skip { position:absolute; right:4.5vw; bottom:9.5rem; padding:.85rem 1.8rem; border:2px solid rgba(255,255,255,.9); border-radius:4px;
    background:rgba(42,42,42,.6); color:#fff; font:inherit; font-size:1.15rem; font-weight:700; cursor:pointer; opacity:0; transform:translateY(8px);
    transition:opacity .25s, transform .25s, background .2s; backdrop-filter:blur(4px); }
  .sm-skip.show { opacity:1; transform:none; }
  .sm-skip:hover { background:#fff; color:#000; }
  .sm-next { position:absolute; right:4.5vw; bottom:9.5rem; width:min(30rem, 90vw); padding:1rem; border-radius:8px; background:rgba(20,20,20,.88);
    backdrop-filter:blur(10px); color:#fff; box-shadow:0 12px 40px rgba(0,0,0,.6); opacity:0; transform:translateY(10px); transition:opacity .3s, transform .3s; }
  .sm-next.show { opacity:1; transform:none; }
  .sm-next-info { display:flex; gap:.9rem; align-items:center; }
  .sm-next-thumb { flex:none; width:9rem; aspect-ratio:16/9; border-radius:4px; background:#2a2a2a center/cover; }
  .sm-next-label { color:#b3b3b3; font-size:.85rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; }
  .sm-next-title { margin-top:.3rem; font-size:1rem; font-weight:700; line-height:1.3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .sm-next-actions { display:flex; gap:.6rem; justify-content:flex-end; margin-top:.9rem; }
  .sm-next-credits { padding:.6rem 1rem; border:1px solid rgba(255,255,255,.4); border-radius:4px; background:transparent; color:#fff; font:inherit;
    font-size:.92rem; font-weight:700; cursor:pointer; }
  .sm-next-credits:hover { border-color:#fff; }
  .sm-next-go { position:relative; overflow:hidden; display:flex; align-items:center; gap:.5rem; padding:.6rem 1.2rem; border:0; border-radius:4px;
    background:rgba(255,255,255,.35); color:#000; font:inherit; font-size:.95rem; font-weight:800; cursor:pointer; }
  .sm-next-go > :not(.sm-next-fill) { position:relative; z-index:1; }
  .sm-next-go .sm-ico { width:1.1rem; height:1.1rem; }
  .sm-next-fill { position:absolute; inset:0 auto 0 0; width:0; background:#fff; transition:width .1s linear; }

  /* ---------- Perfis ---------- */
  .sm-av { display:inline-grid; place-items:center; border-radius:6px; overflow:hidden; flex:none; line-height:1; }
  .sm-av > span { font-size:1.2em; filter:drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
  .sm-av-nav { width:2rem; height:2rem; font-size:1.1rem; }
  .sm-av-sm { width:1.7rem; height:1.7rem; font-size:.95rem; }
  .sm-av-md { width:3.4rem; height:3.4rem; font-size:1.7rem; }
  .sm-av-xl { width:clamp(6rem, 10vw, 10rem); height:clamp(6rem, 10vw, 10rem); font-size:clamp(3rem, 5vw, 5rem); border-radius:8px; }
  .sm-av-add { background:transparent; border:2px solid #6d6d6d; color:#8c8c8c; }
  .sm-av-add .sm-ico { width:45% !important; height:45% !important; }
  .sm-pop-prof .sm-av { margin-right:.1rem; }
  #sm-profiles { position:fixed; inset:0; z-index:9900; display:grid; place-items:center; background:#141414; color:#fff; overflow-y:auto;
    font-family:"Netflix Sans","Helvetica Neue",Helvetica,Arial,sans-serif; animation:sm-ddin .25s ease-out; }
  .sm-gate { display:flex; flex-direction:column; align-items:center; padding:3rem 4vw; }
  .sm-gate h1 { margin:0 0 2.2rem; font-size:clamp(2rem, 3.5vw, 3.5rem); font-weight:500; }
  .sm-prof-list { display:flex; flex-wrap:wrap; justify-content:center; gap:2vw; margin:0 0 3rem; padding:0; list-style:none; }
  .sm-prof { display:flex; flex-direction:column; align-items:center; gap:.8rem; border:0; background:none; color:#808080; font:inherit; cursor:pointer; padding:0; }
  .sm-prof-av { position:relative; border-radius:8px; outline:3px solid transparent; outline-offset:0; transition:outline-color .15s; }
  .sm-prof:hover .sm-prof-av, .sm-prof:focus-visible .sm-prof-av { outline-color:#fff; }
  .sm-prof:hover, .sm-prof:focus-visible { color:#fff; outline:none; }
  .sm-prof-name { font-size:clamp(.95rem, 1.3vw, 1.3rem); }
  .sm-prof-kids { margin-top:-.4rem; font-size:.75rem; font-weight:700; color:#b3b3b3; text-transform:uppercase; letter-spacing:.06em; }
  .sm-prof-edit { position:absolute; inset:0; display:grid; place-items:center; border-radius:8px; background:rgba(0,0,0,.55); }
  .sm-prof-edit .sm-ico { width:30% !important; height:30% !important; color:#fff; }
  .sm-gate-btn { padding:.6em 1.8em; border:1px solid #808080; background:transparent; color:#808080; font:inherit; font-size:1.1rem; letter-spacing:.15em;
    text-transform:uppercase; cursor:pointer; transition:color .15s, border-color .15s; }
  .sm-gate-btn:hover { color:#fff; border-color:#fff; }
  .sm-gate-btn.white { background:#fff; color:#141414; border-color:#fff; font-weight:700; }
  .sm-gate-btn.white:hover { background:#e50914; color:#fff; border-color:#e50914; }
  .sm-gate-btn.danger:hover { color:#ff6b6b; border-color:#ff6b6b; }
  .sm-editor { align-items:stretch; max-width:44rem; width:100%; }
  .sm-editor h1 { font-size:clamp(1.8rem, 3vw, 3rem); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #333; }
  .sm-edit-body { display:flex; gap:1.6rem; align-items:flex-start; padding-bottom:1.6rem; border-bottom:1px solid #333; }
  .sm-edit-fields { flex:1; display:flex; flex-direction:column; gap:1rem; min-width:0; }
  .sm-edit-name { padding:.7rem .9rem; border:0; background:#666; color:#fff; font:inherit; font-size:1.1rem; outline:none; }
  .sm-edit-name:focus { background:#777; }
  .sm-edit-label { color:#b3b3b3; font-size:.9rem; }
  .sm-edit-grid { display:flex; flex-wrap:wrap; gap:.6rem; }
  .sm-edit-pick { padding:0; border:0; background:none; cursor:pointer; border-radius:8px; outline:3px solid transparent; transition:outline-color .15s, transform .15s; }
  .sm-edit-pick:hover { transform:scale(1.07); }
  .sm-edit-pick.on { outline-color:#fff; }
  .sm-edit-kids { display:flex; align-items:center; gap:.8rem; cursor:pointer; }
  .sm-edit-kids input { position:absolute; opacity:0; width:1px; height:1px; }
  .sm-toggle { position:relative; flex:none; width:2.8rem; height:1.6rem; border-radius:999px; background:#555; transition:background .2s; }
  .sm-toggle::after { content:""; position:absolute; top:.2rem; left:.2rem; width:1.2rem; height:1.2rem; border-radius:50%; background:#fff; transition:transform .2s; }
  .sm-edit-kids input:checked + .sm-toggle { background:#e50914; }
  .sm-edit-kids input:checked + .sm-toggle::after { transform:translateX(1.2rem); }
  .sm-edit-kids input:focus-visible + .sm-toggle { outline:2px solid #fff; outline-offset:2px; }
  .sm-edit-kids span { display:flex; flex-direction:column; }
  .sm-edit-kids small { color:#b3b3b3; }
  .sm-edit-note { margin:0; color:#b3b3b3; font-size:.9rem; }
  .sm-edit-actions { display:flex; flex-wrap:wrap; gap:1rem; margin-top:1.6rem; }

  /* ---------- Avaliação (polegares) ---------- */
  .sm-thumbwrap { position:relative; display:inline-flex; }
  /* O Stremio põe overflow:hidden em todas as divs; o painel dos polegares precisa sair da caixa dos botões */
  .sm-thumbs, .sm-thumbwrap, .sm-x-btns, .sm-x-row, .sm-x-info, .sm-x, .sm-actions, .sm-pv-btns, .sm-pv-body { overflow:visible !important; }
  .sm-thumb .sm-ico, .sm-thumb-opt .sm-ico { width:52% !important; height:52% !important; }
  .sm-flip { transform:rotate(180deg); }
  .sm-dbl { position:relative; display:inline-flex; width:70%; height:60%; }
  .sm-dbl .sm-ico { position:absolute; width:78% !important; height:78% !important; }
  .sm-dbl .sm-ico:first-child { left:0; top:18%; opacity:.85; }
  .sm-dbl .sm-ico:last-child { right:0; top:0; }
  .sm-thumb.rated { border-color:#fff !important; }
  .sm-thumbs { position:absolute; z-index:5; left:50%; top:50%; display:flex; gap:.15rem; padding:.2rem; border-radius:999px; background:#232323;
    box-shadow:0 4px 18px rgba(0,0,0,.6); transform:translate(-50%, -50%) scale(.6); opacity:0; pointer-events:none; transition:opacity .15s, transform .18s; }
  .sm-thumbwrap.open .sm-thumbs { opacity:1; transform:translate(-50%, -50%) scale(1); pointer-events:auto; }
  .sm-thumb-opt { position:relative; display:grid; place-items:center; width:2.3rem; height:2.3rem; padding:0; border:0; border-radius:50%; background:transparent;
    color:#fff; cursor:pointer; transition:background .15s, transform .15s; }
  .sm-thumb-opt:hover { background:rgba(255,255,255,.15); transform:scale(1.12); }
  .sm-thumb-opt.on { background:rgba(255,255,255,.25); }
  .sm-thumb-tip { position:absolute; bottom:calc(100% + .35rem); left:50%; transform:translateX(-50%); padding:.2rem .5rem; border-radius:4px;
    background:#e5e5e5; color:#111; font-size:.72rem; font-weight:700; white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .12s; }
  .sm-thumb-opt:hover .sm-thumb-tip { opacity:1; }
  .sm-actions .sm-thumbwrap .sm-thumb { width:2.6rem; height:2.6rem; }
  .sm-x .sm-thumb-opt { width:clamp(1.5rem, 1.75vw, 2.2rem); height:clamp(1.5rem, 1.75vw, 2.2rem); }
  .sm-x .sm-thumb-tip { display:none; }

  /* ---------- Trailer na capa expandida ---------- */
  /* 16:9 cobrindo a capa (que é bem mais larga): corta em cima e embaixo, e um pouco das bordas do player */
  .sm-x-video { position:absolute; left:50%; top:50%; width:100%; height:auto; aspect-ratio:16/9; border:0; transform:translate(-50%, -50%) scale(1.12); opacity:0;
    transition:opacity .6s ease; pointer-events:none; }
  .sm-card.trailer .sm-x-video { opacity:1; }
  .sm-x-bg { overflow:hidden; }
  .sm-x-bg::after { z-index:1; }
  .sm-card.trailer .sm-x-bg::after { background:linear-gradient(90deg, rgba(0,0,0,.9) 0%, rgba(0,0,0,.55) 34%, transparent 62%); }
  .sm-x-sound { position:absolute; z-index:4; right:4%; top:8%; width:clamp(1.5rem, 1.75vw, 2.2rem) !important; height:clamp(1.5rem, 1.75vw, 2.2rem) !important;
    border-width:2px; border-color:rgba(255,255,255,.55); background:rgba(0,0,0,.35); }
  .sm-x-sound[hidden] { display:none; }
  .sm-x-sound .sm-ico { width:55% !important; height:55% !important; }

  /* ===================== App Netflix ===================== */
  #sm-app { position:fixed; inset:0; z-index:9000; overflow-y:auto; overflow-x:hidden; background:#141414; color:#fff;
    font-family:"Netflix Sans","Helvetica Neue",Helvetica,Arial,sans-serif; -webkit-font-smoothing:antialiased;
    scrollbar-width:thin; scrollbar-color:#444 transparent; --pad:4vw; --gap:.4vw; --per:6; }
  #sm-app[hidden] { display:none; }
  @media (max-width:1399px) { #sm-app { --per:5; } }
  @media (max-width:1099px) { #sm-app { --per:4; } }
  @media (max-width:799px) { #sm-app { --per:3; } }
  @media (max-width:499px) { #sm-app { --per:2; } }
  #sm-app button { font-family:inherit; }
  #sm-app .sm-ico { width:1.2em; height:1.2em; flex:none; }

  /* Barra superior */
  .sm-nav { position:sticky; top:0; z-index:20; height:68px; margin-bottom:-68px; display:flex; align-items:center; gap:2.2rem;
    padding:0 var(--pad); background:linear-gradient(180deg, rgba(0,0,0,.7) 10%, transparent); transition:background-color .4s; }
  .sm-nav.solid { background-color:#141414; }
  .sm-wordmark { font:900 1.9rem/1 "Bebas Neue", Impact, "Arial Black", sans-serif; letter-spacing:.04em; color:#e50914;
    cursor:pointer; user-select:none; }
  .sm-links { display:flex; gap:1.3rem; margin:0; padding:0; list-style:none; }
  .sm-links a { color:#e5e5e5; font-size:.88rem; text-decoration:none; cursor:pointer; transition:color .3s; }
  .sm-links a:hover { color:#b3b3b3; }
  .sm-links a.active { color:#fff; font-weight:700; cursor:default; }
  .sm-nav-right { margin-left:auto; display:flex; align-items:center; gap:1.1rem; }
  .sm-iconbtn { display:grid; place-items:center; width:2.2rem; height:2.2rem; padding:0; border:0; background:none; color:#fff; cursor:pointer; font-size:1.15rem; }
  .sm-search { display:flex; align-items:center; gap:.4rem; height:2.2rem; padding:0 .4rem; border:1px solid transparent; transition:all .3s; }
  .sm-search.open { background:rgba(0,0,0,.75); border-color:#fff; }
  .sm-search input { width:0; padding:0; border:0; outline:none; background:none; color:#fff; font:inherit; font-size:.9rem; transition:width .3s; }
  .sm-search.open input { width:14rem; }
  .sm-search .sm-iconbtn { width:1.8rem; }
  #sm-app .sm-switch { margin:0; height:2rem; background:rgba(0,0,0,.5); }

  /* Destaque */
  .sm-hero { position:relative; height:56.25vw; max-height:92vh; min-height:24rem; overflow:hidden; background:#000; }
  .sm-hero-bg, .sm-hero-video { position:absolute; inset:0; background-size:cover; background-position:center 15%; }
  .sm-hero-bg { opacity:0; transition:opacity 1s; }
  .sm-hero.ready .sm-hero-bg { opacity:1; }
  .sm-hero-video { opacity:0; transition:opacity 1.2s; pointer-events:none; overflow:hidden; }
  .sm-hero-video iframe { position:absolute; top:50%; left:50%; width:100%; height:100%; transform:translate(-50%,-50%) scale(1.35); border:0; }
  .sm-hero.playing .sm-hero-video { opacity:1; }
  .sm-hero-shade { position:absolute; inset:0; pointer-events:none;
    background:linear-gradient(77deg, rgba(0,0,0,.7) 0%, rgba(0,0,0,.15) 50%, transparent 85%),
               linear-gradient(0deg, #141414 0%, #141414 4%, rgba(20,20,20,.7) 16%, transparent 38%); }
  .sm-hero-info { position:absolute; left:var(--pad); bottom:35%; width:36%; z-index:2; }
  .sm-hero-logo { display:block; width:100%; max-height:12vw; object-fit:contain; object-position:left bottom; margin-bottom:1.2vw;
    transform-origin:left bottom; transition:transform 1.3s cubic-bezier(.2,.8,.2,1); filter:drop-shadow(0 2px 10px rgba(0,0,0,.5)); }
  .sm-hero-title { margin:0 0 1.2vw; font-size:clamp(2rem, 4.5vw, 5rem); font-weight:900; line-height:1; letter-spacing:-.01em;
    text-shadow:2px 2px 8px rgba(0,0,0,.6); transform-origin:left bottom; transition:transform 1.3s cubic-bezier(.2,.8,.2,1); }
  .sm-hero-badge { display:flex; align-items:center; gap:.7rem; margin-bottom:1vw; font-size:clamp(1rem, 1.6vw, 1.6rem); font-weight:700;
    text-shadow:1px 1px 4px rgba(0,0,0,.6); transition:opacity .6s; }
  .sm-top10 { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; flex:none;
    width:1.6em; height:1.75em; border-radius:2px; background:#e50914; font-size:1em; line-height:1; }
  .sm-top10 span { font-size:.3em; font-weight:900; letter-spacing:.06em; }
  .sm-top10 b { font-size:.72em; font-weight:900; letter-spacing:-.06em; margin-top:.02em; }
  .sm-hero-desc { margin:0 0 1.5vw; font-size:clamp(.9rem, 1.25vw, 1.4rem); line-height:1.35; text-shadow:2px 2px 4px rgba(0,0,0,.45);
    display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; transition:opacity .8s, max-height .8s; max-height:8em; }
  .sm-hero.playing .sm-hero-logo, .sm-hero.playing .sm-hero-title { transform:scale(.7); }
  .sm-hero.playing .sm-hero-desc, .sm-hero.playing .sm-hero-badge { opacity:0; max-height:0; margin:0; }
  .sm-actions { display:flex; gap:.7rem; }
  .sm-btn { display:inline-flex; align-items:center; gap:.7rem; padding:.55em 1.7em .55em 1.3em; border:0; border-radius:4px;
    font-size:clamp(.95rem, 1.2vw, 1.3rem); font-weight:700; cursor:pointer; transition:background .15s; white-space:nowrap; }
  .sm-btn .sm-ico { width:1.5em; height:1.5em; }
  .sm-btn-white { background:#fff; color:#000; }
  .sm-btn-white:hover { background:rgba(255,255,255,.75); }
  .sm-btn-gray { background:rgba(109,109,110,.7); color:#fff; }
  .sm-btn-gray:hover { background:rgba(109,109,110,.4); }
  .sm-hero-side { position:absolute; right:0; bottom:35%; z-index:2; display:flex; align-items:center; gap:1rem; }
  .sm-round { display:grid; place-items:center; width:2.6rem; height:2.6rem; border-radius:50%; border:1px solid rgba(255,255,255,.7);
    background:rgba(42,42,42,.6); color:#fff; cursor:pointer; padding:0; transition:border-color .2s, background .2s; }
  .sm-round:hover { border-color:#fff; background:rgba(255,255,255,.1); }
  .sm-round .sm-ico { width:1.25rem !important; height:1.25rem !important; }
  .sm-maturity { display:flex; align-items:center; height:2.4rem; padding:0 3.5vw 0 .8rem; background:rgba(51,51,51,.6);
    border-left:3px solid #dcdcdc; font-size:1.05rem; }

  /* Fileiras */
  .sm-rows { position:relative; z-index:3; margin-top:-9vw; padding-bottom:4rem; }
  .sm-rows.flat { margin-top:0; padding-top:90px; }
  .sm-row { margin:0 0 3vw; }
  .sm-row-head { display:flex; align-items:baseline; gap:1rem; margin:0 var(--pad) .6rem; }
  .sm-row-title { margin:0; font-size:clamp(1rem, 1.4vw, 1.5rem); font-weight:700; color:#e5e5e5; }
  .sm-explore { font-size:.85rem; font-weight:700; color:#54b9c5; text-decoration:none; opacity:0; transform:translateX(-.5rem);
    transition:opacity .3s, transform .3s; cursor:pointer; }
  .sm-row:hover .sm-explore { opacity:1; transform:none; }
  .sm-dashes { margin-left:auto; display:flex; gap:2px; opacity:0; transition:opacity .3s; }
  .sm-row:hover .sm-dashes { opacity:1; }
  .sm-dashes i { width:.8rem; height:2px; background:#4d4d4d; }
  .sm-dashes i.on { background:#aaa; }
  .sm-slider { position:relative; }
  .sm-track { display:flex; gap:var(--gap); overflow-x:auto; overflow-y:visible; scroll-behavior:smooth; scrollbar-width:none;
    padding:0 var(--pad); scroll-padding:0 var(--pad); }
  .sm-track::-webkit-scrollbar { display:none; }
  .sm-arrow { position:absolute; top:0; bottom:0; z-index:4; width:calc(var(--pad) - var(--gap)); display:grid; place-items:center;
    border:0; padding:0; color:#fff; background:rgba(20,20,20,.5); cursor:pointer; opacity:0; transition:opacity .2s, background .2s; }
  .sm-arrow.l { left:0; border-radius:0 4px 4px 0; }
  .sm-arrow.r { right:0; border-radius:4px 0 0 4px; }
  .sm-arrow .sm-ico { width:2.2vw !important; height:2.2vw !important; min-width:1.4rem; min-height:1.4rem; transition:transform .15s; }
  .sm-row:hover .sm-arrow:not([disabled]) { opacity:1; }
  .sm-arrow:hover { background:rgba(20,20,20,.7); }
  .sm-arrow:hover .sm-ico { transform:scale(1.25); }
  .sm-arrow[disabled] { display:none; }

  /* Cards */
  .sm-card { position:relative; flex:0 0 calc((100% - var(--pad) * 2 - var(--gap) * (var(--per) - 1)) / var(--per));
    flex-basis:calc((100vw - var(--pad) * 2 - var(--gap) * (var(--per) - 1)) / var(--per)); aspect-ratio:16/9;
    border-radius:4px; overflow:hidden; background:#232323 center/cover no-repeat; cursor:pointer; }
  .sm-card::after { content:""; position:absolute; inset:0; background:linear-gradient(0deg, rgba(0,0,0,.55) 0%, transparent 45%); }
  .sm-card-logo { position:absolute; z-index:1; left:7%; bottom:12%; max-width:62%; max-height:42%; object-fit:contain; object-position:left bottom;
    filter:drop-shadow(0 1px 4px rgba(0,0,0,.8)); }
  .sm-card-name { position:absolute; z-index:1; left:7%; right:7%; bottom:10%; font-size:clamp(.8rem, 1.05vw, 1.15rem); font-weight:800;
    line-height:1.1; text-shadow:0 1px 4px rgba(0,0,0,.9); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .sm-card-ep { position:absolute; z-index:2; right:6%; top:7%; padding:.12rem .4rem; border-radius:3px; background:rgba(0,0,0,.72);
    font-size:clamp(.58rem, .66vw, .78rem); font-weight:700; color:#fff; }
  .sm-card-progress { position:absolute; z-index:2; left:7%; right:7%; bottom:5%; height:3px; background:rgba(128,128,128,.7); }
  .sm-card-progress i { display:block; height:100%; background:#e50914; }
  .sm-card.skeleton { background:#222; animation:sm-pulse 1.4s ease-in-out infinite; }
  .sm-card.skeleton::after { display:none; }
  @keyframes sm-pulse { 50% { opacity:.55; } }
  .sm-card:focus-visible { outline:2px solid #fff; outline-offset:2px; }

  /* Capa que se expande (layout novo da Netflix): cresce na fileira e mostra selo, sinopse e botões */
  #sm-app { --cw:calc((100vw - var(--pad) * 2 - var(--gap) * (var(--per) - 1)) / var(--per)); }
  .sm-track > .sm-card:not(.rank) { aspect-ratio:auto; height:calc(var(--cw) * 9 / 16);
    transition:flex-basis .38s cubic-bezier(.2,.8,.2,1), box-shadow .3s; }
  .sm-track > .sm-card.expanded { flex-basis:calc(var(--cw) * 2 + var(--gap)); box-shadow:0 0 0 2px rgba(255,255,255,.85); z-index:2; }
  .sm-card.expanded::after, .sm-card.expanded > .sm-card-logo, .sm-card.expanded > .sm-card-name { opacity:0; }
  .sm-card > .sm-card-logo, .sm-card > .sm-card-name { transition:opacity .2s; }
  .sm-x { position:absolute; inset:0; z-index:3; opacity:0; transition:opacity .25s; pointer-events:none; }
  .sm-card.expanded .sm-x { opacity:1; transition-delay:.12s; pointer-events:auto; }
  .sm-x-bg { position:absolute; inset:0; background:#181818 center right/cover no-repeat; }
  .sm-x-bg::after { content:""; position:absolute; inset:0;
    background:linear-gradient(90deg, rgba(0,0,0,.95) 0%, rgba(0,0,0,.78) 38%, rgba(0,0,0,.15) 72%, transparent 100%); }
  .sm-x-info { position:relative; z-index:1; box-sizing:border-box; width:64%; height:100%; padding:clamp(.5rem, .8vw, 1rem) clamp(.7rem, 1vw, 1.2rem);
    display:flex; flex-direction:column; justify-content:flex-end; gap:clamp(.15rem, .35vw, .4rem); }
  .sm-x-logo { max-width:62%; max-height:30%; object-fit:contain; object-position:left center; margin-bottom:auto;
    filter:drop-shadow(0 1px 4px rgba(0,0,0,.8)); }
  .sm-x-title { margin-bottom:auto; font-size:clamp(.85rem, 1.1vw, 1.25rem); font-weight:800; line-height:1.1; }
  .sm-x-badge { display:flex; align-items:center; gap:.4rem; font-size:clamp(.62rem, .72vw, .85rem); font-weight:700; }
  .sm-x-badge .sm-top10 { transform:scale(.8); transform-origin:left center; margin-right:-.3rem; }
  .sm-x-badge.new { color:#e50914; letter-spacing:.02em; }
  .sm-x .sm-meta { margin:0; gap:.4rem; font-size:clamp(.58rem, .66vw, .8rem); flex-wrap:nowrap; white-space:nowrap; overflow:hidden; }
  .sm-x .sm-cert { font-size:.85em; }
  .sm-x-desc { margin:0; font-size:clamp(.6rem, .7vw, .85rem); line-height:1.35; color:#d6d6d6;
    display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .sm-x-row { display:flex; align-items:center; gap:.55rem; min-width:0; }
  .sm-x-btns { display:flex; gap:.3rem; flex:none; }
  .sm-x-btns .sm-round { width:clamp(1.5rem, 1.75vw, 2.2rem); height:clamp(1.5rem, 1.75vw, 2.2rem); border-width:2px; border-color:rgba(255,255,255,.55); }
  .sm-x-btns .sm-round .sm-ico { width:55% !important; height:55% !important; }
  .sm-x-btns .sm-round.white { background:#fff; color:#000; border-color:#fff; }
  .sm-pv-badge { margin-bottom:.6rem; }

  /* Fileira que aparece conforme você navega */
  .sm-row.fresh { animation:sm-rowin .6s cubic-bezier(.2,.8,.2,1); }
  @keyframes sm-rowin { from { opacity:0; transform:translateY(-14px); } to { opacity:1; transform:none; } }

  /* Top 10 */
  .sm-card.rank { aspect-ratio:auto; height:calc(((100vw - var(--pad) * 2 - var(--gap) * (var(--per) - 1)) / var(--per)) * .84);
    overflow:visible; background:none; display:flex; align-items:stretch; }
  .sm-card.rank::after { display:none; }
  .sm-rank-num { flex:0 0 48%; position:relative; }
  .sm-rank-num svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
  .sm-rank-poster { flex:0 0 56%; margin-left:-4%; border-radius:4px; background:#222 center/cover no-repeat; position:relative; z-index:1;
    box-shadow:-6px 0 16px rgba(0,0,0,.6); }

  /* Prévia ao passar o mouse */
  #sm-preview { position:fixed; z-index:9500; border-radius:6px; overflow:hidden; background:#181818; color:#fff;
    box-shadow:0 8px 32px rgba(0,0,0,.85); transform-origin:center; opacity:0; transform:scale(.68); pointer-events:none;
    transition:opacity .22s ease, transform .3s cubic-bezier(.2,.8,.2,1); font-family:"Netflix Sans","Helvetica Neue",Helvetica,Arial,sans-serif; }
  #sm-preview.show { opacity:1; transform:scale(1); pointer-events:auto; }
  .sm-pv-img { position:relative; aspect-ratio:16/9; background:#232323 center/cover; cursor:pointer; }
  .sm-pv-img .sm-card-logo { max-height:40%; bottom:10%; }
  .sm-pv-body { padding:.9rem 1rem 1.1rem; }
  .sm-pv-btns { display:flex; gap:.5rem; margin-bottom:.8rem; }
  .sm-pv-btns .sm-round { width:2.3rem; height:2.3rem; border-width:2px; border-color:rgba(255,255,255,.5); }
  .sm-pv-btns .sm-round.white { background:#fff; color:#000; border-color:#fff; }
  .sm-pv-btns .sm-round.white:hover { background:#e6e6e6; }
  .sm-pv-btns .push { margin-left:auto; }
  .sm-meta { display:flex; flex-wrap:wrap; align-items:center; gap:.5rem; font-size:.85rem; color:#bcbcbc; margin-bottom:.55rem; }
  .sm-match { color:#46d369; font-weight:700; }
  .sm-cert { display:inline-grid; place-items:center; min-width:1.6rem; height:1.45rem; padding:0 .3rem; border-radius:3px;
    font-size:.78rem; font-weight:800; color:#fff; background:#555; }
  .sm-cert.c-L { background:#0c9447; } .sm-cert.c-10 { background:#0f7dc2; } .sm-cert.c-12 { background:#f8c411; color:#000; }
  .sm-cert.c-14 { background:#e67824; } .sm-cert.c-16 { background:#db2827; } .sm-cert.c-18 { background:#1d1815; border:1px solid #fff; }
  .sm-hd { padding:0 .35rem; border:1px solid rgba(255,255,255,.4); border-radius:3px; font-size:.68rem; line-height:1.3; }
  .sm-genres { display:flex; flex-wrap:wrap; gap:.15rem .5rem; font-size:.85rem; }
  .sm-genres span + span::before { content:"•"; margin-right:.5rem; color:#646464; }

  /* Mais informações */
  #sm-modal { position:fixed; inset:0; z-index:9600; overflow-y:auto; background:rgba(0,0,0,.7); opacity:0; transition:opacity .25s;
    font-family:"Netflix Sans","Helvetica Neue",Helvetica,Arial,sans-serif; color:#fff; }
  #sm-modal.show { opacity:1; }
  .sm-dialog { position:relative; width:min(850px, 94vw); margin:2rem auto; border-radius:8px; overflow:hidden; background:#181818;
    box-shadow:0 10px 50px rgba(0,0,0,.8); transform:translateY(30px) scale(.97); transition:transform .3s cubic-bezier(.2,.8,.2,1); }
  #sm-modal.show .sm-dialog { transform:none; }
  .sm-dlg-hero { position:relative; aspect-ratio:16/9; background:#000 center/cover; }
  .sm-dlg-hero::after { content:""; position:absolute; inset:0; background:linear-gradient(0deg, #181818 0%, transparent 50%); }
  .sm-dlg-info { position:absolute; z-index:2; left:3rem; bottom:2.5rem; width:55%; }
  .sm-dlg-info .sm-hero-logo { max-height:9rem; }
  .sm-dlg-info .sm-hero-title { font-size:2.6rem; }
  .sm-dlg-close { position:absolute; z-index:3; top:1rem; right:1rem; width:2.4rem; height:2.4rem; border-radius:50%; border:0;
    background:#181818; color:#fff; display:grid; place-items:center; cursor:pointer; padding:0; }
  .sm-dlg-body { padding:0 3rem 2.5rem; }
  .sm-dlg-cols { display:grid; grid-template-columns:2fr 1fr; gap:2rem; }
  .sm-dlg-desc { margin:.6rem 0 0; font-size:1.05rem; line-height:1.5; }
  .sm-dlg-tagline { margin:.4rem 0 0; color:#bcbcbc; font-style:italic; }
  .sm-dlg-side { font-size:.88rem; line-height:1.6; color:#ddd; }
  .sm-dlg-side span { color:#777; }
  .sm-dlg-section { margin-top:2.5rem; }
  .sm-dlg-section-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
  .sm-dlg-section h3 { margin:0; font-size:1.5rem; font-weight:700; }
  .sm-dd { position:relative; display:inline-block; overflow:visible !important; }
  .sm-dlg-section-head, .sm-dlg-section { overflow:visible !important; }
  .sm-dd-btn { display:flex; align-items:center; gap:.6rem; padding:.6rem .8rem .6rem 1.1rem; border:1px solid rgba(255,255,255,.18); border-radius:8px;
    background:rgba(255,255,255,.08); color:#fff; font:inherit; font-size:1rem; font-weight:700; cursor:pointer; transition:background .2s, border-color .2s; }
  .sm-dd-btn:hover, .sm-dd-btn[aria-expanded="true"] { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.35); }
  .sm-dd-btn .sm-dd-hint { font-weight:400; }
  .sm-dd-btn > .sm-ico { width:1.1rem; height:1.1rem; transition:transform .2s; }
  .sm-dd-btn[aria-expanded="true"] > .sm-ico { transform:rotate(180deg); }
  .sm-dd-panel { position:absolute; right:0; top:calc(100% + .45rem); z-index:5; min-width:max(100%, 22rem); max-height:min(26rem, 60vh); overflow-y:auto;
    padding:.4rem; border-radius:10px; background:rgba(38,38,38,.97); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.1);
    box-shadow:0 18px 50px rgba(0,0,0,.65); animation:sm-ddin .16s ease-out; scrollbar-width:thin; scrollbar-color:#5a5a5a transparent; }
  .sm-dd-panel::-webkit-scrollbar { width:8px; }
  .sm-dd-panel::-webkit-scrollbar-thumb { background:#5a5a5a; border-radius:8px; border:2px solid transparent; background-clip:padding-box; }
  @keyframes sm-ddin { from { opacity:0; transform:translateY(-6px); } }
  .sm-dd-item { display:flex; align-items:center; gap:.6rem; width:100%; padding:.6rem .8rem .6rem .5rem; border:0; border-radius:6px; background:none;
    color:#d6d6d6; font:inherit; font-size:.95rem; text-align:left; cursor:pointer; }
  .sm-dd-item:hover, .sm-dd-item:focus-visible { background:rgba(255,255,255,.1); color:#fff; outline:none; }
  .sm-dd-item.on { color:#fff; font-weight:700; }
  .sm-dd-check { flex:none; width:1.1rem; height:1.1rem; display:grid; place-items:center; color:var(--sm-accent, #e50914); }
  .sm-dd-check .sm-ico { width:1.1rem; height:1.1rem; }
  .sm-dd-name { flex:1; min-width:0; }
  .sm-dd-hint { flex:none; color:#8c8c8c; font-size:.85em; }
  #sm-modal, #sm-modal * { scrollbar-width:thin; scrollbar-color:#4a4a4a transparent; }
  .sm-ep { display:grid; grid-template-columns:2.5rem 9rem 1fr; gap:1rem; align-items:center; padding:1.2rem 1rem; border-bottom:1px solid #404040;
    border-radius:4px; cursor:pointer; }
  .sm-ep.hl { background:#333; }
  .sm-ep.soon { opacity:.6; }
  .sm-ep-img .sm-card-progress { left:6%; right:6%; bottom:7%; height:3px; }
  .sm-ep-right { display:flex; align-items:center; gap:.6rem; flex:none; }
  .sm-ep-tag { padding:.1rem .4rem; border-radius:3px; background:#e50914; color:#fff; font-size:.68rem; letter-spacing:.04em; }
  .sm-ep-tag.soon { background:#424242; }
  .sm-ep-cont { margin:-.1rem 0 .35rem; color:#e50914; font-size:.82rem; font-weight:700; }
  .sm-resume { display:flex; align-items:center; gap:.8rem; margin-top:1rem; max-width:22rem; color:#ddd; font-size:.9rem; }
  .sm-resume .sm-card-progress { position:relative; inset:auto; flex:1; height:4px; border-radius:2px; overflow:hidden; }
  .sm-sim-rank { position:absolute; top:.4rem; right:.4rem; }
  .sm-sim-new { position:absolute; left:0; bottom:.6rem; padding:.15rem .5rem; background:#e50914; color:#fff; font-size:.7rem; font-weight:800;
    letter-spacing:.04em; border-radius:0 3px 3px 0; }

  /* Barra: notificações e perfil */
  .sm-popwrap { position:relative; }
  .sm-nav, .sm-nav-right, .sm-popwrap { overflow:visible !important; }
  .sm-bell { position:relative; }
  .sm-bell-count { position:absolute; top:.05rem; right:-.1rem; min-width:1.05rem; height:1.05rem; padding:0 .25rem; box-sizing:border-box;
    border-radius:.6rem; background:#e50914; color:#fff; font-size:.65rem; font-weight:800; line-height:1.05rem; text-align:center; }
  .sm-bell-count[hidden] { display:none; }
  .sm-profile { display:flex; align-items:center; gap:.4rem; padding:0; border:0; background:none; color:#fff; cursor:pointer; }
  .sm-profile > .sm-ico { width:1rem !important; height:1rem !important; transition:transform .2s; }
  .sm-profile[aria-expanded="true"] > .sm-ico { transform:rotate(180deg); }
  .sm-avatar { display:grid; place-items:center; width:2rem; height:2rem; border-radius:6px; font-weight:800; font-size:1rem;
    background:linear-gradient(135deg, #e50914, #8a0c12); color:#fff; }
  .sm-pop { position:absolute; right:0; top:calc(100% + .9rem); z-index:30; min-width:15rem; padding:.4rem; border-radius:10px;
    background:rgba(24,24,24,.97); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.1); box-shadow:0 18px 50px rgba(0,0,0,.7);
    animation:sm-ddin .16s ease-out; }
  .sm-pop::before { content:""; position:absolute; top:-6px; right:.9rem; width:10px; height:10px; transform:rotate(45deg);
    background:rgba(24,24,24,.97); border-left:1px solid rgba(255,255,255,.1); border-top:1px solid rgba(255,255,255,.1); }
  .sm-pop hr { margin:.35rem .4rem; border:0; border-top:1px solid rgba(255,255,255,.12); }
  .sm-pop-head { padding:.6rem .7rem .5rem; font-weight:700; font-size:.95rem; }
  .sm-pop-empty { padding:1.2rem .8rem; color:#999; font-size:.9rem; }
  .sm-pop-item { display:flex; align-items:center; gap:.75rem; width:100%; padding:.6rem .7rem; border:0; border-radius:6px; background:none; color:#ddd;
    font:inherit; font-size:.92rem; text-align:left; cursor:pointer; }
  .sm-pop-item:hover, .sm-pop-item:focus-visible { background:rgba(255,255,255,.1); color:#fff; outline:none; }
  .sm-pop-item .sm-ico { width:1.15rem !important; height:1.15rem !important; color:#b3b3b3; }
  .sm-notif { width:24rem; }
  .sm-notif-list { max-height:min(28rem, 70vh); overflow-y:auto; scrollbar-width:thin; scrollbar-color:#4a4a4a transparent; }
  .sm-notif-item { display:flex; align-items:center; gap:.85rem; width:100%; padding:.55rem .6rem; border:0; border-radius:6px; background:none;
    color:#ddd; font:inherit; text-align:left; cursor:pointer; position:relative; }
  .sm-notif-item:hover { background:rgba(255,255,255,.08); }
  .sm-notif-item.unread::after { content:""; position:absolute; right:.6rem; top:50%; width:.45rem; height:.45rem; margin-top:-.22rem;
    border-radius:50%; background:#e50914; }
  .sm-notif-img { flex:none; width:7.5rem; aspect-ratio:16/9; border-radius:4px; background:#2a2a2a center/cover; }
  .sm-notif-text { display:flex; flex-direction:column; gap:.2rem; min-width:0; padding-right:1rem; font-size:.85rem; }
  .sm-notif-text b { color:#fff; }
  .sm-notif-text span { color:#a3a3a3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sm-ep:hover { background:#2a2a2a; }
  .sm-ep-num { font-size:1.5rem; color:#d2d2d2; text-align:center; }
  .sm-ep-img { position:relative; aspect-ratio:16/9; border-radius:4px; background:#2a2a2a center/cover; }
  .sm-ep-img .sm-ico { position:absolute; inset:0; margin:auto; width:2.4rem; height:2.4rem; padding:.5rem; border:1px solid #fff;
    border-radius:50%; background:rgba(30,30,20,.5); opacity:0; transition:opacity .2s; }
  .sm-ep:hover .sm-ep-img .sm-ico { opacity:1; }
  .sm-ep-top { display:flex; justify-content:space-between; gap:1rem; font-weight:700; margin-bottom:.35rem; }
  .sm-ep-desc { margin:0; font-size:.88rem; line-height:1.4; color:#d2d2d2; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
  .sm-similar { display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; }
  .sm-sim { border-radius:4px; overflow:hidden; background:#2f2f2f; cursor:pointer; }
  .sm-sim-img { position:relative; aspect-ratio:16/9; background:#232323 center/cover; }
  .sm-sim-img .sm-ico { position:absolute; inset:0; margin:auto; width:2.6rem; height:2.6rem; padding:.55rem; border:1px solid #fff;
    border-radius:50%; background:rgba(30,30,20,.5); opacity:0; transition:opacity .2s; }
  .sm-sim:hover .sm-sim-img .sm-ico { opacity:1; }
  .sm-sim-body { padding:.8rem 1rem 1.1rem; }
  .sm-sim-body p { margin:.6rem 0 0; font-size:.82rem; line-height:1.4; color:#d2d2d2; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
  .sm-sim-name { font-weight:700; font-size:.95rem; }
  .sm-empty { padding:6rem var(--pad); text-align:center; color:#aaa; font-size:1.1rem; }
  .sm-grid { display:grid; grid-template-columns:repeat(var(--per), minmax(0, 1fr)); gap:3vw var(--gap); padding:0 var(--pad); }
  .sm-grid .sm-card { flex-basis:auto; min-width:0; }
  .sm-searchpage, .sm-sp-main, .sm-sp-results, .sm-feed { overflow:visible !important; }
  .sm-feed-block + .sm-feed-block { margin-top:2.6rem; }
  .sm-feed-more { margin-top:2.6rem; }
  .sm-searchpage { display:grid; grid-template-columns:minmax(15rem, 22rem) 1fr; gap:3vw; padding:100px var(--pad) 4rem; min-height:100vh; box-sizing:border-box; }
  .sm-sp-side { position:sticky; top:90px; align-self:start; max-height:calc(100vh - 110px); display:flex; flex-direction:column; min-height:0; }
  .sm-sp-box { display:flex; align-items:center; gap:.7rem; padding:0 .9rem; height:3.1rem; border-radius:6px; background:#242424;
    border:2px solid transparent; transition:border-color .2s, background .2s; }
  .sm-sp-box:focus-within { border-color:#fff; background:#2b2b2b; }
  .sm-sp-box > .sm-ico { width:1.3rem; height:1.3rem; flex:none; color:#b3b3b3; }
  .sm-sp-input { flex:1; min-width:0; border:0; outline:none; background:none; color:#fff; font:inherit; font-size:1.05rem; }
  .sm-sp-input::placeholder { color:#8c8c8c; }
  .sm-sp-clear { display:grid; place-items:center; width:1.8rem; height:1.8rem; border:0; border-radius:50%; background:none; color:#b3b3b3; cursor:pointer; padding:0; }
  .sm-sp-clear:hover { background:#3a3a3a; color:#fff; }
  .sm-sp-clear[hidden] { display:none; }
  .sm-sp-clear .sm-ico { width:1rem; height:1rem; }
  .sm-sp-label { margin:1.6rem 0 .5rem .9rem; color:#8c8c8c; font-size:.8rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; min-height:1em; }
  .sm-sp-list { list-style:none; margin:0; padding:0; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#444 transparent; }
  .sm-sp-item { display:block; width:100%; padding:.55rem .9rem; border:0; border-radius:6px; background:none; color:#b3b3b3; text-align:left;
    font:inherit; font-size:1.05rem; cursor:pointer; transition:background .15s, color .15s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sm-sp-item b { color:#fff; font-weight:700; }
  .sm-sp-item:hover, .sm-sp-item:focus-visible { background:#2b2b2b; color:#fff; outline:none; }
  .sm-sp-item.on { color:#fff; font-weight:700; box-shadow:inset 3px 0 0 var(--sm-accent, #e50914); }
  .sm-sp-main { min-width:0; --per:4; }
  @media (min-width:1700px) { .sm-sp-main { --per:5; } }
  @media (max-width:1199px) { .sm-sp-main { --per:3; } }
  @media (max-width:899px) { .sm-searchpage { grid-template-columns:1fr; } .sm-sp-side { position:static; max-height:none; } .sm-sp-main { --per:2; } }
  .sm-sp-title { margin:.6rem 0 1.2rem; font-size:1.3rem; font-weight:700; color:#e5e5e5; }
  .sm-sp-main .sm-grid { padding:0; }
  .sm-results { gap:1.2vw var(--gap); }
  .sm-ghost { background:#232323; animation:sm-pulse 1.4s ease-in-out infinite; cursor:default; }
  .sm-iconbtn.active { color:#fff; }
  .sm-noresults { margin:2rem var(--pad); color:#e5e5e5; font-size:1rem; line-height:1.5; }
  .sm-noresults p { margin:0 0 .9rem; }
  .sm-noresults ul { margin:0; padding-left:1.6rem; }
  /* Explorar tudo */
  .sm-explore-head { display:flex; align-items:center; gap:1rem; margin:0 var(--pad) 1.6rem; }
  .sm-explore-head .sm-page-title { margin:0; }
  .sm-back { display:grid; place-items:center; width:2.6rem; height:2.6rem; border:1px solid rgba(255,255,255,.35); border-radius:50%;
    background:rgba(255,255,255,.06); color:#fff; cursor:pointer; padding:0; transition:background .2s, border-color .2s; }
  .sm-back:hover { background:rgba(255,255,255,.15); border-color:#fff; }
  .sm-back .sm-ico { width:1.3rem !important; height:1.3rem !important; }
  .sm-explorepage .sm-feed-more { padding:0 var(--pad); }

  /* Fim da Home */
  .sm-home-more { height:1px; }
  .sm-end { display:flex; flex-direction:column; align-items:center; gap:1rem; padding:4rem var(--pad) 5rem; color:#b3b3b3; font-size:1.05rem; }
  .sm-end p { margin:0; }

  /* Novidades e populares: capas de estreia */
  .sm-newspage { padding-top:100px; }
  .sm-newspage > .sm-page-title { margin-bottom:1.2rem; }
  .sm-up-date { position:absolute; z-index:2; top:0; left:7%; display:flex; flex-direction:column; align-items:center; padding:.35rem .5rem .4rem;
    background:rgba(0,0,0,.72); border-radius:0 0 4px 4px; line-height:1; }
  .sm-up-date b { font-size:clamp(1rem, 1.4vw, 1.6rem); font-weight:800; }
  .sm-up-date span { font-size:clamp(.55rem, .62vw, .72rem); font-weight:700; letter-spacing:.08em; color:#e50914; margin-top:.15rem; }
  .sm-up .sm-card-logo { bottom:25%; max-height:28%; max-width:55%; }
  .sm-up .sm-card-name { bottom:24%; }
  .sm-up-label { position:absolute; z-index:2; left:7%; bottom:7%; font-size:clamp(.62rem, .72vw, .85rem); font-weight:700; color:#fff;
    text-shadow:0 1px 3px rgba(0,0,0,.9); }
  .sm-up-bell { position:absolute; z-index:3; right:5%; bottom:6%; display:grid; place-items:center; width:clamp(1.6rem, 1.9vw, 2.2rem);
    height:clamp(1.6rem, 1.9vw, 2.2rem); padding:0; border:2px solid rgba(255,255,255,.7); border-radius:50%; background:rgba(20,20,20,.6);
    color:#fff; cursor:pointer; opacity:.85; transition:opacity .2s, background .2s, transform .2s; }
  .sm-up-bell .sm-ico { width:55% !important; height:55% !important; }
  .sm-up:hover .sm-up-bell, .sm-up-bell.on { opacity:1; }
  .sm-up-bell:hover { background:rgba(255,255,255,.2); transform:scale(1.08); }
  .sm-up-bell.on { background:#fff; color:#000; border-color:#fff; }
  .sm-up:hover { outline:2px solid rgba(255,255,255,.8); outline-offset:-2px; }
  .sm-remind.on { background:rgba(109,109,110,.7); color:#fff; }
  .sm-up-when { font-size:1.1rem; margin-bottom:.6rem; }
  .sm-up-when b { color:#46d369; }
  .sm-up-when span { color:#d2d2d2; }
  .sm-up-kind { padding:.1rem .45rem; border:1px solid rgba(255,255,255,.4); border-radius:3px; }
  .sm-page-title { margin:0 var(--pad) 1.5rem; font-size:clamp(1.4rem, 2.4vw, 2.4rem); font-weight:700; }
  .sm-offline { margin:0 var(--pad) 2rem; padding:1rem 1.2rem; border-radius:4px; background:#2a1414; border:1px solid #7a1e1e; color:#ffd5d5; font-size:.95rem; }
  @media (max-width:760px) {
    .sm-links { display:none; }
    .sm-hero-info { width:auto; right:var(--pad); bottom:22%; }
    .sm-hero-desc, .sm-hero-side { display:none; }
    .sm-dlg-info { left:1.2rem; width:80%; bottom:1.2rem; }
    .sm-dlg-body { padding:0 1.2rem 2rem; }
    .sm-dlg-cols { grid-template-columns:1fr; }
    .sm-similar { grid-template-columns:repeat(2, 1fr); }
    .sm-ep { grid-template-columns:7rem 1fr; }
    .sm-ep-num { display:none; }
  }
  `;

  function injectStyles() {
    let el = document.getElementById('sm-styles');
    if (!el) {
      el = document.createElement('style');
      el.id = 'sm-styles';
      document.head.appendChild(el);
    }
    el.textContent = CSS;
  }

  // ===========================================================================
  // Seletor de modo (pílula + menu), usado no Stremio e dentro do app
  // ===========================================================================
  let menuEl = null;

  function makeSwitcher() {
    const btn = h('button', { type: 'button', class: 'sm-switch', title: 'Trocar modo de streaming (Alt+M)' });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuEl ? closeMenu() : openMenu(btn);
    });
    fillSwitcher(btn);
    return btn;
  }
  function fillSwitcher(btn) {
    const mode = MODES[state.mode];
    btn.style.setProperty('--sm-accent', mode.accent);
    btn.replaceChildren(h('span', { class: 'sm-dot' }), h('span', { text: mode.key === 'stremio' ? 'Modo' : mode.label }), icon('down'));
  }
  const refreshSwitchers = () => document.querySelectorAll('.sm-switch').forEach(fillSwitcher);

  function ensureSwitchers() {
    for (const nav of document.querySelectorAll('nav[class*="horizontal-nav-bar-container"]')) {
      const host = nav.querySelector('[class*="buttons-container"]');
      if (host && !host.querySelector(':scope > .sm-switch')) host.prepend(makeSwitcher());
    }
  }

  function openMenu(anchor) {
    // Confere de novo se há vinheta local (o arquivo pode ter sido colocado depois).
    for (const k of Object.keys(MODES)) { if (localIntro[k] === false) delete localIntro[k]; checkLocalIntro(k); }
    closeMenu();
    const items = Object.values(MODES).map((mode) =>
      h('button', { type: 'button', class: 'sm-item', role: 'menuitemradio', 'aria-checked': String(mode.key === state.mode),
        onclick: () => switchMode(mode.key) },
        h('span', { class: 'sm-dot', style: { background: mode.accent } }),
        h('span', { text: mode.label }),
        mode.key === state.mode ? h('span', { class: 'sm-check', text: '✓' }) : null),
    );
    const cb = h('input', { type: 'checkbox' });
    cb.checked = state.showInDefault;
    cb.addEventListener('change', () => {
      state.showInDefault = cb.checked;
      store.set('showInDefault', cb.checked);
      applyRootAttrs();
    });
    const input = h('input', { type: 'text', spellcheck: 'false' });
    input.value = state.addonUrl;
    input.addEventListener('change', () => {
      state.addonUrl = input.value.trim().replace(/\/(manifest\.json)?$/, '') || DEFAULTS.addonUrl;
      store.set('addonUrl', state.addonUrl);
      requests.clear();
      rebuildApp();
    });
    const menu = h('div', { class: 'sm-menu', role: 'menu', onclick: (e) => e.stopPropagation() },
      h('h4', { text: 'Modo de streaming' }),
      items,
      h('div', { class: 'sm-sep' }),
      h('label', { class: 'sm-toggle' }, cb, 'Mostrar fileiras dos streamings no modo padrão'),
      h('label', { class: 'sm-field' }, 'Endereço do addon', input),
      h('div', { class: 'sm-hint', text: 'Atalho: Alt+M' }),
    );
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${r.bottom + 8}px`;
    menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, r.right - menu.offsetWidth))}px`;
    menuEl = menu;
    menu.querySelector('.sm-item[aria-checked="true"]')?.focus();
  }
  function closeMenu() {
    menuEl?.remove();
    menuEl = null;
  }

  // ===========================================================================
  // Troca de modo
  // ===========================================================================
  function applyRootAttrs() {
    const root = document.documentElement;
    root.dataset.smMode = state.mode;
    root.style.setProperty('--sm-accent', MODES[state.mode].accent);
    if (state.showInDefault) root.dataset.smShowDefault = '';
    else delete root.dataset.smShowDefault;
  }

  function applyMode(key) {
    state.mode = MODES[key] ? key : 'stremio';
    store.set('mode', state.mode);
    applyRootAttrs();
    refreshSwitchers();
    if (MODES[state.mode].provider) {
      rebuildApp();
      if (!isAppRoute()) location.hash = '#/';
    } else destroyApp();
    schedule();
  }

  // Transição simples (modo sem vídeo, ou se o vídeo não carregar): o nome aparece e some.
  function buildIntro(mode) {
    const overlay = h('div', { class: 'sm-intro', role: 'presentation' });
    overlay.style.setProperty('--sm-accent', mode.accent);
    overlay.appendChild(h('div', { class: 'sm-intro-word', text: mode.splash }));
    return overlay;
  }

  function simpleTransition(mode, reduced) {
    const total = reduced ? 600 : 1500;
    const overlay = buildIntro(mode);
    overlay.style.setProperty('--t', `${total}ms`);
    document.body.appendChild(overlay);
    setTimeout(() => applyMode(mode.key), total * 0.35);
    setTimeout(() => {
      overlay.remove();
      state.transitioning = false;
    }, total + 50);
  }

  // ---------- Vinheta local (arquivo em addon/intro/<modo>.mp4) ----------
  // Tocada num <video> comum: tela cheia, sem controles nem marcas. Verificada com antecedência para não atrasar o clique.
  const localIntro = {};
  function checkLocalIntro(key) {
    if (!MODES[key]?.provider || key in localIntro) return;
    localIntro[key] = false;
    fetch(`${state.addonUrl}/sm/intro/${key}`, { method: 'HEAD' })
      .then((r) => { localIntro[key] = r.ok; })
      .catch(() => {});
  }

  function localVideoTransition(mode) {
    const video = h('video', { src: `${state.addonUrl}/sm/intro/${mode.key}`, preload: 'auto', playsinline: true });
    video.muted = store.get('introSound') === false;
    const overlay = h('div', { class: 'sm-intro-video', role: 'presentation' }, video);
    document.body.appendChild(overlay);
    let started = false;
    let finished = false;
    let switched = false;
    const doSwitch = () => { if (!switched) { switched = true; applyMode(mode.key); } };
    const finish = () => {
      if (finished) return;
      finished = true;
      doSwitch();
      overlay.classList.add('out');
      setTimeout(() => {
        overlay.remove();
        state.transitioning = false;
      }, 550);
    };
    const fallback = () => {
      if (started || finished) return;
      finished = true;
      overlay.remove();
      videoTransition(mode); // sem o arquivo: vinheta pelo YouTube
    };
    video.addEventListener('playing', () => {
      if (started) return;
      started = true;
      overlay.classList.add('playing');
      setTimeout(doSwitch, 400);
    });
    video.addEventListener('ended', finish);
    // Vinhetas costumam terminar com tela preta: começa o fade para a Home nesse trecho.
    video.addEventListener('timeupdate', () => {
      if (started && video.duration && video.duration - video.currentTime < 0.75) finish();
    });
    video.addEventListener('error', fallback);
    video.play().catch(() => {
      // Autoplay com som bloqueado: tenta sem som.
      video.muted = true;
      video.play().catch(fallback);
    });
    setTimeout(fallback, 4000);
    setTimeout(finish, 20000); // trava de segurança
  }

  // ---------- Vinheta em vídeo (YouTube) ----------
  // A tela fica preta até o vídeo começar; o modo troca por trás e a vinheta some quando o vídeo acaba.
  // O YouTube desenha um botão de pausa no centro do player nos primeiros segundos; uma pequena área
  // desfocada por cima esconde o botão. Se o vídeo não começar em 4 s, segue com a transição simples.
  function videoTransition(mode) {
    const params = new URLSearchParams({
      autoplay: '1', mute: store.get('introSound') === false ? '1' : '0', controls: '0', disablekb: '1', fs: '0',
      iv_load_policy: '3', modestbranding: '1', playsinline: '1', rel: '0', enablejsapi: '1', origin: location.origin,
    });
    const iframe = h('iframe', { src: `https://www.youtube-nocookie.com/embed/${mode.introVideo}?${params}`,
      allow: 'autoplay; encrypted-media', title: 'Vinheta', tabindex: '-1' });
    const overlay = h('div', { class: 'sm-intro-video', role: 'presentation' }, iframe, h('div', { class: 'sm-intro-hide' }));
    document.body.appendChild(overlay);
    let started = false;
    let finished = false;
    let switched = false;
    const doSwitch = () => { if (!switched) { switched = true; applyMode(mode.key); } };
    const finish = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener('message', onMsg);
      doSwitch();
      overlay.classList.add('out');
      setTimeout(() => {
        overlay.remove();
        state.transitioning = false;
      }, 550);
    };
    const onMsg = (e) => {
      if (e.source !== iframe.contentWindow) return;
      let d;
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      const info = d?.info && typeof d.info === 'object' ? d.info : {};
      const ps = d?.event === 'onStateChange' ? d.info : info.playerState;
      if (ps === 1 && !started) {
        started = true;
        overlay.classList.add('playing');
        setTimeout(doSwitch, 400);
      }
      if (started && ps === 0) finish();
      if (started && info.duration && info.currentTime && info.duration - info.currentTime < 0.2) finish();
    };
    window.addEventListener('message', onMsg);
    iframe.addEventListener('load', () => {
      const ping = () => iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
      ping();
      setTimeout(ping, 500);
    });
    setTimeout(() => {
      if (started || finished) return;
      finished = true;
      window.removeEventListener('message', onMsg);
      overlay.remove();
      simpleTransition(mode, false);
    }, 4000);
    setTimeout(finish, 12000); // trava de segurança
  }

  function switchMode(key, animate = true) {
    if (key === state.mode || state.transitioning) return;
    closeMenu();
    closeModal();
    hidePreview();
    const mode = MODES[key] || MODES.stremio;
    if (!animate) return applyMode(mode.key);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    state.transitioning = true;
    if (mode.provider && localIntro[mode.key] && !reduced) localVideoTransition(mode);
    else if (mode.introVideo && !reduced) videoTransition(mode);
    else simpleTransition(mode, reduced);
  }

  // Marca as fileiras do Stremio (para escondê-las no modo padrão).
  function tagRows() {
    const prefixes = Object.values(MODES).filter((m) => m.prefix);
    for (const row of document.querySelectorAll('[data-board-row]')) {
      const title = row.getAttribute('data-board-row') || '';
      const m = prefixes.find((p) => title.startsWith(p.prefix));
      const streamer = m ? m.key : '';
      if (row.dataset.smStreamer !== streamer) row.dataset.smStreamer = streamer;
    }
  }

  // ===========================================================================
  // App do modo streaming (Netflix)
  // ===========================================================================
  let app = null;
  let rowObserver = null;
  let heroCtl = null;

  function destroyApp() {
    heroCtl?.destroy();
    heroCtl = null;
    rowObserver?.disconnect();
    app?.remove();
    app = null;
    hidePreview();
    closeModal();
  }

  function rebuildApp() {
    destroyApp();
    const mode = MODES[state.mode];
    if (!mode.provider) return;
    if (shouldAskProfile()) setTimeout(() => { if (app && !gateEl) openProfileGate(false); }, 0);
    app = h('div', { id: 'sm-app', role: 'main' });
    app.addEventListener('scroll', () => {
      app.querySelector('.sm-nav')?.classList.toggle('solid', app.scrollTop > 20);
      hidePreview();
      heroCtl?.onScroll(app.scrollTop);
    }, { passive: true });
    document.body.appendChild(app);
    renderPage();
    syncAppVisibility();
  }

  function syncAppVisibility() {
    if (!app) return;
    const q = searchQuery();
    const show = q !== null || isBoardRoute();
    if (q !== null && state.page !== 'search') {
      state.prevPage = state.page;
      state.page = 'search';
      state.query = q;
      renderPage();
      app.scrollTop = 0;
    } else if (q !== null && state.query !== q) {
      state.query = q;
      renderSearch();
      app.scrollTop = 0;
    } else if (q === null && show && state.page === 'search') {
      state.page = state.prevPage || 'home';
      renderPage();
    }
    if (app.hidden === !show) return;
    app.hidden = !show;
    if (show) heroCtl?.resume();
    else {
      heroCtl?.pause();
      hidePreview();
      closeModal();
    }
  }

  function setPage(page) {
    if (state.page === 'search') {
      state.page = page;
      location.hash = '#/';
      renderPage();
      app.scrollTop = 0;
      return;
    }
    if (state.page === page) return;
    state.page = page;
    renderPage();
    app.scrollTop = 0;
  }

  function renderPage() {
    const mode = MODES[state.mode];
    closePop();
    heroCtl?.destroy();
    heroCtl = null;
    rowObserver?.disconnect();
    app.replaceChildren(buildNav(mode));
    if (state.page === 'mylist') return renderMyList();
    if (state.page === 'search') return renderSearch();
    if (state.page === 'explore') return renderExplore();
    if (state.page === 'new') return renderNews();
    const heroWrap = h('div');
    const rows = h('div', { class: 'sm-rows' });
    app.append(heroWrap, rows);
    buildHero(mode, heroWrap, rows);
    buildRows(mode, rows);
  }

  // ---------- Barra superior ----------
  function buildNav(mode) {
    const links = h('ul', { class: 'sm-links' },
      NAV_PAGES.filter(([key]) => !(isKids() && key === 'new')).map(([key, label]) =>
        h('li', null, h('a', { class: state.page === key ? 'active' : null, text: label, onclick: () => setPage(key) }))));
    const search = h('button', { type: 'button', class: state.page === 'search' ? 'sm-iconbtn active' : 'sm-iconbtn',
      'aria-label': 'Buscar', title: 'Buscar', onclick: () => { if (searchQuery() === null) location.hash = '#/search'; } }, icon('search'));
    return h('nav', { class: 'sm-nav' },
      h('div', { class: 'sm-wordmark', text: mode.wordmark, title: 'Início', onclick: () => setPage('home') }),
      links,
      h('div', { class: 'sm-nav-right' },
        search,
        makeSwitcher(),
        isKids() ? null : buildBell(mode),
        buildProfile()));
  }

  // ---------- Painéis da barra (notificações e perfil) ----------
  let popEl = null;
  function closePop() {
    if (!popEl) return;
    popEl.__btn?.setAttribute('aria-expanded', 'false');
    popEl.remove();
    popEl = null;
    document.removeEventListener('pointerdown', popOutside, true);
  }
  function popOutside(e) {
    if (popEl && !popEl.contains(e.target) && !popEl.__btn.contains(e.target)) closePop();
  }
  function openPop(btn, panel) {
    const same = popEl?.__btn === btn;
    closePop();
    if (same) return;
    panel.__btn = btn;
    btn.setAttribute('aria-expanded', 'true');
    btn.parentElement.appendChild(panel);
    popEl = panel;
    document.addEventListener('pointerdown', popOutside, true);
  }

  // Notificações: o que está no Top 10 e o que acabou de chegar. Marca como visto ao abrir.
  function notifItems(mode) {
    const p = mode.provider;
    return Promise.all([
      catalog('series', `${p}.top10-series`).catch(() => []),
      catalog('movie', `${p}.top10-movies`).catch(() => []),
      catalog('movie', `${p}.new-movies`).catch(() => []),
      catalog('series', `${p}.new-series`).catch(() => []),
    ]).then(([ts, tm, nm, ns]) => {
      const out = [];
      const seen = new Set();
      const add = (kind, it, text, sub) => {
        if (!it || seen.has(it.id)) return;
        seen.add(it.id);
        out.push({ key: `${kind}:${it.id}`, item: it, text, sub });
      };
      const today = new Date().toISOString().slice(0, 10);
      for (const r of reminders()) if (r.date <= today) add('remind', r, 'Chegou! Você pediu para lembrar', r.name);
      ts.slice(0, 3).forEach((it, i) => add('top', it, `Nº ${i + 1} em séries esta semana`, it.name));
      tm.slice(0, 3).forEach((it, i) => add('top', it, `Nº ${i + 1} em filmes esta semana`, it.name));
      for (let i = 0; i < 4; i++) {
        add('new', nm[i], 'Chegou na Netflix', nm[i]?.name);
        add('new', ns[i], 'Nova série', ns[i]?.name);
      }
      return out.slice(0, 12);
    });
  }

  function buildBell(mode) {
    const count = h('span', { class: 'sm-bell-count', hidden: true });
    const btn = h('button', { type: 'button', class: 'sm-iconbtn sm-bell', 'aria-label': 'Notificações', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
      icon('bell'), count);
    const wrap = h('div', { class: 'sm-popwrap' }, btn);
    const seenKeys = () => new Set(store.get('seenNotifs') || []);
    notifItems(mode).then((items) => {
      const n = items.filter((x) => !seenKeys().has(x.key)).length;
      count.textContent = n > 9 ? '9+' : String(n);
      count.hidden = !n;
    });
    btn.addEventListener('click', () => {
      const list = h('div', { class: 'sm-notif-list' }, h('div', { class: 'sm-pop-empty', text: 'Carregando…' }));
      const panel = h('div', { class: 'sm-pop sm-notif', role: 'dialog', 'aria-label': 'Notificações' },
        h('div', { class: 'sm-pop-head', text: 'Novidades' }), list);
      openPop(btn, panel);
      notifItems(mode).then((items) => {
        const seen = seenKeys();
        if (!items.length) return list.replaceChildren(h('div', { class: 'sm-pop-empty', text: 'Nada novo por aqui.' }));
        list.replaceChildren(...items.map((x) =>
          h('button', { type: 'button', class: seen.has(x.key) ? 'sm-notif-item' : 'sm-notif-item unread',
            onclick: () => { closePop(); if (/^tt\d+$/.test(x.item.id)) openModal(x.item); else goSearch(x.item.name); } },
            h('div', { class: 'sm-notif-img', style: { backgroundImage: cssUrl(tmdbSize(x.item.background, 'w300') || cardImage(x.item)) } }),
            h('div', { class: 'sm-notif-text' },
              h('b', { text: x.text }),
              h('span', { text: x.sub || '' })))));
        store.set('seenNotifs', [...new Set([...seen, ...items.map((x) => x.key)])].slice(-200));
        count.hidden = true;
      });
    });
    return wrap;
  }

  // Perfil: atalhos do Stremio e a volta para o modo padrão.
  function avatarEl(p, cls = 'sm-av') {
    const a = AVATARS[p.avatar] || AVATARS[0];
    return h('span', { class: cls, 'aria-hidden': 'true', style: { background: `linear-gradient(135deg, ${a.c[0]}, ${a.c[1]})` } },
      h('span', { text: a.e }));
  }

  function buildProfile() {
    const me = activeProfile();
    const btn = h('button', { type: 'button', class: 'sm-profile', 'aria-label': `Perfil: ${me.name}`, 'aria-haspopup': 'true', 'aria-expanded': 'false' },
      avatarEl(me, 'sm-av sm-av-nav'), icon('down'));
    const wrap = h('div', { class: 'sm-popwrap' }, btn);
    const go = (hash) => () => { closePop(); location.hash = hash; };
    btn.addEventListener('click', () => {
      const item = (ic, text, fn) => h('button', { type: 'button', class: 'sm-pop-item', onclick: fn }, icon(ic), h('span', { text }));
      const others = profiles().filter((p) => p.id !== me.id).map((p) =>
        h('button', { type: 'button', class: 'sm-pop-item sm-pop-prof', onclick: () => { closePop(); selectProfile(p.id); } },
          avatarEl(p, 'sm-av sm-av-sm'), h('span', { text: p.name })));
      openPop(btn, h('div', { class: 'sm-pop sm-profile-menu', role: 'menu' },
        ...others,
        item('pencil', 'Gerenciar perfis', () => { closePop(); openProfileGate(true); }),
        h('hr'),
        item('plus', 'Minha lista', () => { closePop(); setPage('mylist'); }),
        me.kids ? null : item('library', 'Biblioteca do Stremio', go('#/library')),
        me.kids ? null : item('puzzle', 'Addons', go('#/addons')),
        me.kids ? null : item('gear', 'Configurações', go('#/settings')),
        h('hr'),
        item('swap', 'Voltar ao Stremio padrão', () => { closePop(); switchMode('stremio'); })));
    });
    return wrap;
  }

  // ---------- Tela "Quem está assistindo?" ----------
  let gateEl = null;
  function selectProfile(id) {
    store.set('activeProfile', id);
    try { sessionStorage.setItem('sm.profileChosen', '1'); } catch { /* ignora */ }
    state.interest = null;
    gateEl?.remove();
    gateEl = null;
    state.page = 'home';
    if (searchQuery() !== null) location.hash = '#/';
    rebuildApp();
  }

  function shouldAskProfile() {
    try { return !sessionStorage.getItem('sm.profileChosen'); } catch { return false; }
  }

  function openProfileGate(manage = false) {
    gateEl?.remove();
    closeModal();
    hidePreview();
    collapseCard();
    heroCtl?.pause();
    gateEl = h('div', { id: 'sm-profiles', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Quem está assistindo?' });
    document.body.appendChild(gateEl);
    renderGate(manage);
  }

  function renderGate(manage) {
    const list = profiles();
    const tiles = list.map((p) => h('li', null,
      h('button', { type: 'button', class: 'sm-prof', onclick: () => (manage ? renderEditor(p) : selectProfile(p.id)) },
        h('span', { class: 'sm-prof-av' }, avatarEl(p, 'sm-av sm-av-xl'), manage ? h('span', { class: 'sm-prof-edit' }, icon('pencil')) : null),
        h('span', { class: 'sm-prof-name', text: p.name }),
        p.kids ? h('span', { class: 'sm-prof-kids', text: 'Infantil' }) : null)));
    if (list.length < 5) {
      tiles.push(h('li', null, h('button', { type: 'button', class: 'sm-prof add', onclick: () => renderEditor(null) },
        h('span', { class: 'sm-prof-av' }, h('span', { class: 'sm-av sm-av-xl sm-av-add' }, icon('plus'))),
        h('span', { class: 'sm-prof-name', text: 'Adicionar perfil' }))));
    }
    gateEl.replaceChildren(h('div', { class: 'sm-gate' },
      h('h1', { text: manage ? 'Gerenciar perfis' : 'Quem está assistindo?' }),
      h('ul', { class: 'sm-prof-list' }, tiles),
      manage
        ? h('button', { type: 'button', class: 'sm-gate-btn white', onclick: () => renderGate(false) }, 'Concluído')
        : h('button', { type: 'button', class: 'sm-gate-btn', onclick: () => renderGate(true) }, 'Gerenciar perfis')));
    gateEl.querySelector('.sm-prof')?.focus();
  }

  function renderEditor(profile) {
    const isNew = !profile;
    const draft = profile ? { ...profile } : { id: `p${Date.now().toString(36)}`, name: '', avatar: Math.floor(Math.random() * 12), kids: false };
    const preview = h('span', { class: 'sm-edit-av' });
    const paint = () => preview.replaceChildren(avatarEl(draft, 'sm-av sm-av-xl'));
    paint();
    const name = h('input', { type: 'text', class: 'sm-edit-name', maxlength: '20', placeholder: 'Nome', value: draft.name, 'aria-label': 'Nome do perfil' });
    const grid = h('div', { class: 'sm-edit-grid' }, AVATARS.map((a, i) => {
      const b = h('button', { type: 'button', class: i === draft.avatar ? 'sm-edit-pick on' : 'sm-edit-pick', 'aria-label': `Avatar ${a.e}`,
        onclick: () => { draft.avatar = i; grid.querySelectorAll('.sm-edit-pick').forEach((x) => x.classList.remove('on')); b.classList.add('on'); paint(); } },
      avatarEl({ avatar: i }, 'sm-av sm-av-md'));
      return b;
    }));
    const kids = h('input', { type: 'checkbox', id: 'sm-kids', checked: draft.kids, disabled: draft.main });
    const save = () => {
      draft.name = name.value.trim() || (draft.kids ? 'Infantil' : 'Perfil');
      draft.kids = kids.checked && !draft.main;
      const list = profiles();
      const next = isNew ? [...list, draft] : list.map((p) => (p.id === draft.id ? draft : p));
      store.set('profiles', next);
      renderGate(true);
    };
    const remove = () => {
      store.set('profiles', profiles().filter((p) => p.id !== draft.id));
      for (const k of ['history', 'ratings', 'list']) { try { localStorage.removeItem(`streamingModes.${k}:${draft.id}`); } catch { /* ignora */ } }
      if (store.get('activeProfile') === draft.id) store.set('activeProfile', 'main');
      renderGate(true);
    };
    gateEl.replaceChildren(h('div', { class: 'sm-gate sm-editor' },
      h('h1', { text: isNew ? 'Adicionar perfil' : 'Editar perfil' }),
      h('div', { class: 'sm-edit-body' },
        preview,
        h('div', { class: 'sm-edit-fields' },
          name,
          h('div', { class: 'sm-edit-label', text: 'Escolha um avatar' }),
          grid,
          draft.main ? h('p', { class: 'sm-edit-note', text: 'Perfil principal: usa a sua biblioteca do Stremio.' })
            : h('label', { class: 'sm-edit-kids', for: 'sm-kids' }, kids, h('i', { class: 'sm-toggle', 'aria-hidden': 'true' }),
              h('span', null, h('b', { text: 'Perfil infantil' }), h('small', { text: 'Só títulos para crianças (classificação Livre e 10 anos)' }))))),
      h('div', { class: 'sm-edit-actions' },
        h('button', { type: 'button', class: 'sm-gate-btn white', onclick: save }, 'Salvar'),
        h('button', { type: 'button', class: 'sm-gate-btn', onclick: () => renderGate(true) }, 'Cancelar'),
        !isNew && !draft.main ? h('button', { type: 'button', class: 'sm-gate-btn danger', onclick: remove }, 'Excluir perfil') : null)));
    name.focus();
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  }

  // ---------- Avaliação (Não é pra mim / Gostei / Amei!) ----------
  function thumbIcon(r) {
    if (r === 2) return h('span', { class: 'sm-dbl' }, icon('thumb', r > 0), icon('thumb', r > 0));
    const i = icon('thumb', r !== 0);
    if (r === -1) i.classList.add('sm-flip');
    return i;
  }
  function thumbButton(item, cls = 'sm-round') {
    const btn = h('button', { type: 'button', class: `${cls} sm-thumb`, 'aria-label': 'Avaliar' });
    const paint = () => {
      const r = ratingOf(item.id);
      btn.replaceChildren(thumbIcon(r));
      btn.classList.toggle('rated', r !== 0);
      btn.title = r === 2 ? 'Amei!' : r === 1 ? 'Gostei' : r === -1 ? 'Não é pra mim' : 'Avaliar';
    };
    paint();
    const opt = (r, label) => h('button', { type: 'button', class: ratingOf(item.id) === r ? 'sm-thumb-opt on' : 'sm-thumb-opt', title: label, 'aria-label': label,
      onclick: (e) => { e.stopPropagation(); rate(item, r); paint(); pill.querySelectorAll('.sm-thumb-opt').forEach((b, i) => b.classList.toggle('on', ratingOf(item.id) === [-1, 1, 2][i])); } },
    thumbIcon(r), h('span', { class: 'sm-thumb-tip', text: label }));
    const pill = h('div', { class: 'sm-thumbs' }, opt(-1, 'Não é pra mim'), opt(1, 'Gostei'), opt(2, 'Amei!'));
    const wrap = h('span', { class: 'sm-thumbwrap' }, btn, pill);
    let t = null;
    wrap.addEventListener('mouseenter', () => { clearTimeout(t); wrap.classList.add('open'); });
    wrap.addEventListener('mouseleave', () => { t = setTimeout(() => wrap.classList.remove('open'), 250); });
    btn.addEventListener('click', (e) => { e.stopPropagation(); wrap.classList.toggle('open'); });
    return wrap;
  }

  // ---------- Destaque ----------
  function buildHero(mode, wrap, rows) {
    const types = state.page === 'series' ? ['series'] : state.page === 'movies' ? ['movie'] : ['series', 'movie'];
    const sources = (isKids() ? mode.kidsHero : mode.heroCatalogs).filter((c) => types.includes(c.type));
    const hero = h('section', { class: 'sm-hero', 'aria-label': 'Destaque' });
    wrap.appendChild(hero);
    let iframe = null;
    let stopped = false;
    let pausedByScroll = false;
    const ctl = {
      destroy() { stopped = true; window.removeEventListener('message', onMsg); },
      pause() { ytCmd('pauseVideo'); },
      resume() { if (!pausedByScroll) ytCmd('playVideo'); },
      onScroll(y) {
        const off = y > hero.offsetHeight * 0.6;
        if (off !== pausedByScroll) { pausedByScroll = off; ytCmd(off ? 'pauseVideo' : 'playVideo'); }
      },
    };
    heroCtl = ctl;
    function ytCmd(func, args = []) {
      iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    }
    function onMsg(e) {
      if (!iframe || e.source !== iframe.contentWindow) return;
      let data;
      try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      const ps = data?.info?.playerState;
      // O YouTube mostra os controles no centro nos primeiros ~3 s; o trailer só aparece depois disso.
      if (ps === 1 && !showTimer && !hero.classList.contains('playing')) {
        showTimer = setTimeout(() => { if (!stopped) hero.classList.add('playing'); }, 3300);
      }
      if (ps === 0) { clearTimeout(showTimer); showTimer = null; hero.classList.remove('playing'); }
    }
    let showTimer = null;

    (async () => {
      const lists = await Promise.all(sources.map((s) =>
        catalog(s.type, s.id).then((ms) => ms.slice(0, 3).map((m, i) => (s.label ? { ...m, rank: i + 1, rankLabel: s.label } : m))).catch(() => [])));
      const pool = lists.flat().filter((m) => m.background);
      if (stopped) return;
      if (!pool.length) {
        hero.remove();
        rows.classList.add('flat');
        rows.prepend(h('div', { class: 'sm-offline', text:
          offlineText() }));
        return;
      }
      const item = pool[Math.floor(Math.random() * pool.length)];
      const info = h('div', { class: 'sm-hero-info' });
      const bg = h('div', { class: 'sm-hero-bg', style: { backgroundImage: cssUrl(item.background) } });
      const video = h('div', { class: 'sm-hero-video' });
      const side = h('div', { class: 'sm-hero-side' });
      hero.append(bg, video, h('div', { class: 'sm-hero-shade' }), info, side);
      const img = new Image();
      img.onload = img.onerror = () => hero.classList.add('ready');
      img.src = item.background;

      info.append(
        logoOrTitle(item, 'sm-hero-logo', 'sm-hero-title', 'h1'),
        ...(item.rank ? [h('div', { class: 'sm-hero-badge' }, top10Chip(), `Top ${item.rank} ${item.rankLabel}`)] : []),
        item.description ? h('p', { class: 'sm-hero-desc', text: item.description }) : '',
        h('div', { class: 'sm-actions' },
          h('button', { type: 'button', class: 'sm-btn sm-btn-white', onclick: () => play(item) }, icon('play', true), 'Assistir'),
          h('button', { type: 'button', class: 'sm-btn sm-btn-gray', onclick: () => openModal(item) }, icon('info'), 'Mais informações')),
      );

      const d = await details(item.type, item.id);
      if (stopped || !d) return;
      if (d.certification) side.appendChild(h('div', { class: 'sm-maturity' }, certBadge(d.certification)));
      if (d.trailer) {
        const muteBtn = h('button', { type: 'button', class: 'sm-round', 'aria-label': 'Som' });
        const setMuteIcon = () => muteBtn.replaceChildren(icon(state.muted ? 'mute' : 'sound'));
        setMuteIcon();
        muteBtn.addEventListener('click', () => {
          state.muted = !state.muted;
          store.set('muted', state.muted);
          ytCmd(state.muted ? 'mute' : 'unMute');
          setMuteIcon();
        });
        side.prepend(muteBtn);
        window.addEventListener('message', onMsg);
        setTimeout(() => {
          if (stopped) return;
          const k = encodeURIComponent(d.trailer);
          iframe = h('iframe', {
            src: `https://www.youtube-nocookie.com/embed/${k}?autoplay=1&mute=1&controls=0&loop=1&playlist=${k}&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&disablekb=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`,
            allow: 'autoplay; encrypted-media', tabindex: '-1', title: 'Trailer',
          });
          iframe.addEventListener('load', () => {
            iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*');
            if (!state.muted) setTimeout(() => ytCmd('unMute'), 600);
          });
          video.appendChild(iframe);
        }, 2500);
      }
    })();
  }

  // ---------- Fileiras ----------
  function buildRows(mode, container) {
    loadRanks();
    const order = isKids() ? mode.kidsPages : mode.pages[state.page] || mode.pages.home;
    rowObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          rowObserver.unobserve(e.target);
          e.target.__load?.();
        }
      }
    }, { root: app, rootMargin: '600px 0px' });

    manifest().then((mf) => {
      const prefix = `${mode.provider}.`;
      const byId = Object.fromEntries((mf.catalogs || []).filter((c) => c.id.startsWith(prefix)).map((c) => [c.id.slice(prefix.length), c]));
      const seeds = profileSeeds();
      const typeFilter = state.page === 'series' ? 'series' : state.page === 'movies' ? 'movie' : null;
      for (const key of order) {
        let row = null;
        if (key === '@continue') {
          if (continueWatching().length || finishedEpisodes().length) {
            row = makeRow('Continuar assistindo', () => continueRow(typeFilter), { progress: true });
          }
        } else if (key === '@soon') {
          row = makeRow('Em breve na Netflix', () => addon(`/sm/upcoming/${mode.provider}.json`).then((d) => d.items || []),
            { render: (it) => upcomingCard(it), onExplore: () => setPage('new') });
        } else if (key === '@mylist') {
          const items = myList().slice(0, 30).map(fromLibrary);
          if (items.length) row = makeRow('Minha lista', () => Promise.resolve(items), { onExplore: () => setPage('mylist') });
        } else if (key === '@because0' || key === '@because1') {
          // Tenta os itens mais recentes do histórico até achar um com recomendações suficientes.
          const wantType = typeFilter || (key === '@because0' ? 'series' : 'movie');
          const candidates = seeds.filter((s) => s.type === wantType).slice(0, 5);
          if (candidates.length) {
            const prefix = { loved: 'Porque você amou', liked: 'Porque você gostou de', watched: 'Porque você assistiu' };
            row = makeRow('Porque você assistiu', async () => {
              for (const s of candidates) {
                const list = profileFilter(await similar(mode.provider, s.type, s._id));
                if (list.length >= 4) {
                  row.querySelector('.sm-row-title').textContent = `${prefix[s.src] || prefix.watched} ${s.name}`;
                  return list;
                }
              }
              return [];
            });
          }
        } else if (byId[key] && !(isKids() && typeFilter && byId[key].type !== typeFilter)) {
          const c = byId[key];
          const name = c.name.startsWith(mode.prefix) ? c.name.slice(mode.prefix.length) : c.name;
          const isTop = key.startsWith('top10');
          row = makeRow(name, () => catalog(c.type, c.id), {
            rank: isTop,
            onExplore: isTop ? null : () => openExplore(c, name),
          });
        }
        if (row) {
          container.appendChild(row);
          rowObserver.observe(row);
        }
      }
      placeSessionRow();
      appendForYouRows(container, mode, typeFilter);
    }).catch(() => {
      container.classList.add('flat');
      container.appendChild(h('div', { class: 'sm-offline', text:
        offlineText() }));
    });
  }

  function makeRow(title, load, opts = {}) {
    const track = h('div', { class: 'sm-track' });
    const left = h('button', { type: 'button', class: 'sm-arrow l', 'aria-label': 'Anterior', disabled: true }, icon('left'));
    const right = h('button', { type: 'button', class: 'sm-arrow r', 'aria-label': 'Próximo' }, icon('right'));
    const dashes = h('div', { class: 'sm-dashes' });
    const head = h('div', { class: 'sm-row-head' },
      h('h2', { class: 'sm-row-title', text: title }),
      opts.onExplore ? h('a', { class: 'sm-explore', onclick: opts.onExplore }, 'Explorar tudo ›') : null,
      dashes);
    const row = h('section', { class: 'sm-row' }, head, h('div', { class: 'sm-slider' }, left, track, right));
    const n = opts.rank ? 6 : 8;
    for (let i = 0; i < n; i++) track.appendChild(h('div', { class: `sm-card skeleton${opts.rank ? ' rank' : ''}` }));

    const page = () => track.clientWidth - 2 * parseFloat(getComputedStyle(track).paddingLeft);
    const update = () => {
      left.disabled = track.scrollLeft <= 4;
      right.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      const pages = Math.max(1, Math.ceil((track.scrollWidth - track.clientWidth) / page()) + 1);
      const cur = Math.round(track.scrollLeft / page());
      if (dashes.childElementCount !== pages) dashes.replaceChildren(...Array.from({ length: pages }, () => h('i')));
      [...dashes.children].forEach((d, i) => d.classList.toggle('on', i === cur));
    };
    left.addEventListener('click', () => track.scrollBy({ left: -page() }));
    right.addEventListener('click', () => track.scrollBy({ left: page() }));
    track.addEventListener('scroll', () => {
      hidePreview();
      if (Date.now() > ignoreScrollUntil && expandedEl?.parentElement === track) collapseCard();
      requestAnimationFrame(update);
    }, { passive: true });

    row.__load = async () => {
      let items = [];
      try { items = await load(); } catch { items = []; }
      if (!opts.render) items = profileFilter(items, { keepDisliked: opts.rank });
      if (!items.length) return row.remove();
      track.replaceChildren(...items.map((it, i) => (opts.render ? opts.render(it, i) : opts.rank ? rankCard(it, i + 1) : card(it, opts))));
      requestAnimationFrame(update);
    };
    return row;
  }

  // ---------- Cards ----------
  function cardImage(item) {
    if (item.posterShape === 'landscape' && item.poster) return item.poster;
    return tmdbSize(item.background, 'w780') || item.poster;
  }

  function logoOrTitle(item, logoClass, titleClass, tag = 'div') {
    const title = h(tag, { class: titleClass, text: item.name || '' });
    if (!item.logo) return title;
    const img = h('img', { class: logoClass, alt: item.name || '', src: item.logo, loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', () => img.replaceWith(title), { once: true });
    return img;
  }

  function card(item, opts = {}) {
    const el = h('div', { class: 'sm-card', tabindex: '0', role: 'button', 'aria-label': item.name,
      style: { backgroundImage: cssUrl(cardImage(item)) } });
    el.appendChild(logoOrTitle(item, 'sm-card-logo', 'sm-card-name'));
    if (item.epLabel) el.appendChild(h('div', { class: 'sm-card-ep', text: item.epLabel }));
    if (opts.progress && item.progress > 0) {
      el.appendChild(h('div', { class: 'sm-card-progress' }, h('i', { style: { width: `${Math.round(item.progress * 100)}%` } })));
    }
    wireCard(el, item);
    return el;
  }

  function rankCard(item, n) {
    // Número em SVG com contorno, como no Top 10 da Netflix.
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', n === 10 ? '0 0 160 154' : '0 0 92 154');
    svg.setAttribute('preserveAspectRatio', 'xMaxYMax meet');
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', n === 10 ? '154' : '88');
    t.setAttribute('y', '146');
    t.setAttribute('text-anchor', 'end');
    // Estilo inline: o CSS global do Stremio sobrescreve os atributos de fonte do SVG.
    t.setAttribute('style', `font-family:"Arial Black",Impact,sans-serif;font-weight:900;font-size:190px;letter-spacing:${n === 10 ? -28 : 0}px`);
    t.setAttribute('fill', '#141414');
    t.setAttribute('stroke', '#595959');
    t.setAttribute('stroke-width', '5');
    t.textContent = String(n);
    svg.appendChild(t);
    const el = h('div', { class: 'sm-card rank', tabindex: '0', role: 'button', 'aria-label': `${n}. ${item.name}` },
      h('div', { class: 'sm-rank-num' }, svg),
      h('div', { class: 'sm-rank-poster', style: { backgroundImage: cssUrl(tmdbSize(item.poster, 'w342') || item.background) } }));
    wireCard(el, item);
    return el;
  }

  function wireCard(el, item) {
    let timer = null;
    // Nas fileiras a capa se expande no lugar; no Top 10 e nas grades (busca, Minha lista) abre a prévia flutuante.
    const expandable = () => el.parentElement?.classList.contains('sm-track') && !el.classList.contains('rank');
    el.addEventListener('mouseenter', () => {
      const ex = expandable();
      timer = setTimeout(() => (ex ? expandCard(el, item) : showPreview(el, item)), ex ? 380 : 480);
    });
    el.addEventListener('mouseleave', () => {
      clearTimeout(timer);
      if (expandedEl === el) collapseCard();
    });
    el.addEventListener('click', () => { clearTimeout(timer); openModal(item); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openModal(item); });
  }

  const top10Chip = () => h('span', { class: 'sm-top10', 'aria-label': 'Top 10' }, h('span', { text: 'TOP' }), h('b', { text: '10' }));
  function certBadge(c) {
    const v = String(c).replace(/^A/i, '').toUpperCase();
    return h('span', { class: `sm-cert c-${v}`, text: v, title: `Classificação indicativa: ${v === 'L' ? 'livre' : `${v} anos`}` });
  }
  function metaLine(item, d) {
    const rating = d?.rating ?? item.rating;
    const year = d?.year || item.releaseInfo;
    return h('div', { class: 'sm-meta' },
      rating ? h('span', { class: 'sm-match', text: `${Math.round(rating * 10)}% relevante` }) : null,
      d?.certification ? certBadge(d.certification) : null,
      year ? h('span', { text: year }) : null,
      d?.seasonsCount ? h('span', { text: d.seasonsCount === 1 ? '1 temporada' : `${d.seasonsCount} temporadas` })
        : d?.runtime && item.type === 'movie' ? h('span', { text: fmtRuntime(d.runtime) }) : null,
      h('span', { class: 'sm-hd', text: 'HD' }));
  }
  const fmtRuntime = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}min` : ''}`.trim() : `${m}min`);

  // ---------- Selos: Top 10, novidade, aclamado ----------
  const ranks = new Map();
  let ranksLoaded = null;
  function loadRanks() {
    const mode = MODES[state.mode];
    if (!mode.provider) return Promise.resolve();
    if (!ranksLoaded) {
      ranksLoaded = Promise.all(['series', 'movie'].map((type) =>
        catalog(type, `${mode.provider}.top10-${type === 'movie' ? 'movies' : 'series'}`)
          .then((list) => list.forEach((m, i) => { if (!ranks.has(m.id)) ranks.set(m.id, { n: i + 1, type }); }))
          .catch(() => {})));
    }
    return ranksLoaded;
  }
  function badgeFor(item, cls = 'sm-x-badge') {
    const r = ranks.get(item.id);
    if (r) return h('div', { class: cls }, top10Chip(), h('span', { text: `Nº ${r.n} em ${r.type === 'movie' ? 'filmes' : 'séries'} esta semana` }));
    if (Number(item.releaseInfo) >= new Date().getFullYear()) return h('div', { class: `${cls} new`, text: 'NOVIDADE' });
    if (item.rating >= 8) return h('div', { class: cls, text: 'Aclamado pela crítica' });
    return null;
  }

  // ---------- Capa expandida ----------
  let expandedEl = null;
  let ignoreScrollUntil = 0;

  function collapseCard() {
    if (!expandedEl) return;
    const el = expandedEl;
    expandedEl = null;
    el.__trailer?.();
    el.classList.remove('expanded');
    setTimeout(() => { if (expandedEl !== el) el.querySelector(':scope > .sm-x')?.remove(); }, 300);
  }

  function expandCard(el, item) {
    if (expandedEl === el || !el.isConnected || modalEl) return;
    collapseCard();
    hidePreview();
    el.querySelector(':scope > .sm-x')?.remove();
    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
    const listBtn = h('button', { type: 'button', class: 'sm-round', 'aria-label': 'Minha lista' });
    const setListIcon = () => listBtn.replaceChildren(icon(inMyList(item.id) ? 'check' : 'plus'));
    setListIcon();
    listBtn.addEventListener('click', stop(() => { toggleMyList(item); setTimeout(setListIcon, 400); }));
    const meta = metaLine(item, null);
    meta.querySelector('.sm-hd')?.remove();
    meta.querySelector('.sm-match')?.remove();
    const desc = h('p', { class: 'sm-x-desc', text: item.description || '' });
    const info = h('div', { class: 'sm-x-info' },
      logoOrTitle(item, 'sm-x-logo', 'sm-x-title'),
      badgeFor(item),
      desc,
      h('div', { class: 'sm-x-row' }, h('div', { class: 'sm-x-btns' },
        h('button', { type: 'button', class: 'sm-round white', 'aria-label': 'Assistir', onclick: stop(() => play(item)) }, icon('play', true)),
        listBtn,
        thumbButton(item),
        h('button', { type: 'button', class: 'sm-round', 'aria-label': 'Mais informações', onclick: stop(() => openModal(item)) }, icon('down'))), meta));
    el.appendChild(h('div', { class: 'sm-x' },
      h('div', { class: 'sm-x-bg', style: { backgroundImage: cssUrl(tmdbSize(item.background, 'w1280') || cardImage(item)) } }),
      info));

    // Garante que a capa inteira fique visível (a da ponta direita empurra a fileira).
    const track = el.parentElement;
    const r = el.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const over = r.left + r.width * 2 + gap - (tr.right - pad);
    el.classList.add('expanded');
    expandedEl = el;
    if (over > 1) {
      ignoreScrollUntil = Date.now() + 900;
      track.scrollBy({ left: over });
    }

    details(item.type, item.id).then((d) => {
      if (!d || expandedEl !== el) return;
      const m = metaLine(item, d);
      m.querySelector('.sm-hd')?.remove();
      m.querySelector('.sm-match')?.remove(); // falta espaço na capa
      meta.replaceWith(m);
      if (!item.description && d.description) desc.textContent = d.description;
      if (d.trailer) setTimeout(() => { if (expandedEl === el) startCardTrailer(el, d.trailer); }, 900);
    });
  }

  // Trailer na capa expandida (como a prévia da Netflix). Começa sem som e escondido: o YouTube mostra
  // os controles nos primeiros ~3 s; depois aparece e liga o som (se o som das prévias estiver ativado).
  function startCardTrailer(el, key) {
    const bg = el.querySelector(':scope > .sm-x .sm-x-bg');
    if (!bg || el.__trailer) return;
    const params = new URLSearchParams({ autoplay: '1', mute: '1', controls: '0', disablekb: '1', fs: '0', iv_load_policy: '3',
      modestbranding: '1', playsinline: '1', rel: '0', enablejsapi: '1', origin: location.origin });
    const iframe = h('iframe', { class: 'sm-x-video', src: `https://www.youtube-nocookie.com/embed/${key}?${params}`,
      allow: 'autoplay; encrypted-media', tabindex: '-1', title: 'Trailer' });
    const soundOn = () => store.get('previewSound') !== false;
    const cmd = (func, args = []) => iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    const sound = h('button', { type: 'button', class: 'sm-round sm-x-sound', 'aria-label': 'Som da prévia', hidden: true });
    const paintSound = () => sound.replaceChildren(icon(soundOn() ? 'sound' : 'mute'));
    paintSound();
    sound.addEventListener('click', (e) => {
      e.stopPropagation();
      store.set('previewSound', !soundOn());
      paintSound();
      if (soundOn()) { cmd('unMute'); cmd('setVolume', [70]); } else cmd('mute');
    });
    let shown = false;
    let timer = null;
    const onMsg = (e) => {
      if (e.source !== iframe.contentWindow) return;
      let d;
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      const ps = d?.info?.playerState ?? (d?.event === 'onStateChange' ? d.info : undefined);
      if (ps === 1 && !shown && !timer) {
        timer = setTimeout(() => {
          if (expandedEl !== el) return;
          shown = true;
          el.classList.add('trailer');
          sound.hidden = false;
          if (soundOn()) { cmd('unMute'); cmd('setVolume', [70]); }
        }, 3000);
      }
      if (ps === 0) el.classList.remove('trailer');
    };
    window.addEventListener('message', onMsg);
    iframe.addEventListener('load', () => cmd('addEventListener', ['onStateChange']) || iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'));
    bg.appendChild(iframe);
    el.querySelector(':scope > .sm-x')?.appendChild(sound);
    heroCtl?.pause();
    el.__trailer = () => {
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      iframe.remove();
      sound.remove();
      el.classList.remove('trailer');
      el.__trailer = null;
      if (!modalEl) heroCtl?.resume();
    };
  }

  // ---------- "Porque você se interessou por…" ----------
  // Aparece na hora, logo abaixo da primeira fileira, com títulos parecidos com o último que você abriu.
  function noteInterest(item) {
    if (!item?.id || !item.type) return;
    state.interest = { id: item.id, type: item.type, name: item.name };
  }

  function placeSessionRow() {
    const it = state.interest;
    if (!app || !it || !['home', 'series', 'movies'].includes(state.page)) return;
    if ((state.page === 'series' && it.type !== 'series') || (state.page === 'movies' && it.type !== 'movie')) return;
    const container = app.querySelector('.sm-rows:not(.sm-searchpage)');
    if (!container) return;
    const existing = container.querySelector(':scope > .sm-row.session');
    if (existing?.dataset.seed === it.id) return;
    const mode = MODES[state.mode];
    const row = makeRow(`Porque você se interessou por ${it.name}`, async () => {
      const list = await similar(mode.provider, it.type, it.id);
      return list.length >= 3 ? list : [];
    });
    row.classList.add('session', 'fresh');
    row.dataset.seed = it.id;
    const first = [...container.querySelectorAll(':scope > .sm-row')].find((r) => !r.classList.contains('session'));
    if (existing) existing.replaceWith(row);
    else if (first) first.after(row);
    else container.prepend(row);
    row.__load();
  }

  // ---------- Prévia ao passar o mouse ----------
  let previewEl = null;
  let previewFor = null;

  function hidePreview() {
    if (!previewEl) return;
    const el = previewEl;
    previewEl = null;
    previewFor = null;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }

  function showPreview(anchor, item) {
    if (previewFor === anchor || !anchor.isConnected || document.getElementById('sm-modal')) return;
    hidePreview();
    const r = anchor.getBoundingClientRect();
    const w = Math.max(r.width * 1.5, 300);
    const listBtn = h('button', { type: 'button', class: 'sm-round', 'aria-label': 'Minha lista' });
    const setListIcon = () => listBtn.replaceChildren(icon(inMyList(item.id) ? 'check' : 'plus'));
    setListIcon();
    listBtn.addEventListener('click', () => { toggleMyList(item); setTimeout(setListIcon, 400); });
    const meta = metaLine(item, null);
    const genres = h('div', { class: 'sm-genres' }, (item.genres || []).map((g) => h('span', { text: g })));
    const el = h('div', { id: 'sm-preview' },
      h('div', { class: 'sm-pv-img', style: { backgroundImage: cssUrl(tmdbSize(item.background, 'w780') || cardImage(item)) },
        onclick: () => openModal(item) }, logoOrTitle(item, 'sm-card-logo', 'sm-card-name')),
      h('div', { class: 'sm-pv-body' },
        h('div', { class: 'sm-pv-btns' },
          h('button', { type: 'button', class: 'sm-round white', 'aria-label': 'Assistir', onclick: () => play(item) }, icon('play', true)),
          listBtn,
          thumbButton(item),
          h('button', { type: 'button', class: 'sm-round push', 'aria-label': 'Mais informações', onclick: () => openModal(item) }, icon('down'))),
        badgeFor(item, 'sm-x-badge sm-pv-badge'), meta, genres));
    el.style.width = `${w}px`;
    document.body.appendChild(el);
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    const top = Math.max(8, Math.min(window.innerHeight - el.offsetHeight - 8, r.top + r.height / 2 - (w * 0.5625) / 2));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transformOrigin = `${r.left + r.width / 2 - left}px ${r.top + r.height / 2 - top}px`;
    el.addEventListener('mouseleave', hidePreview);
    previewEl = el;
    previewFor = anchor;
    requestAnimationFrame(() => el.classList.add('show'));
    details(item.type, item.id).then((d) => {
      if (!d || previewEl !== el) return;
      meta.replaceWith(metaLine(item, d));
      if (!item.genres?.length && d.genres?.length) genres.replaceChildren(...d.genres.slice(0, 3).map((g) => h('span', { text: g })));
    });
  }

  // ---------- Menu suspenso (substitui o <select> nativo) ----------
  function dropdown(options, value, onChange, label) {
    const cur = () => options.find((o) => o.value === value) || options[0];
    const btnLabel = h('span', { class: 'sm-dd-label' });
    const btnHint = h('span', { class: 'sm-dd-hint' });
    const btn = h('button', { type: 'button', class: 'sm-dd-btn', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label },
      btnLabel, btnHint, icon('down'));
    const root = h('div', { class: 'sm-dd' }, btn);
    let panel = null;
    const paint = () => {
      btnLabel.textContent = cur().label;
      btnHint.textContent = cur().hint || '';
    };
    paint();
    const close = () => {
      if (!panel) return;
      panel.remove();
      panel = null;
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    };
    const outside = (e) => { if (!root.contains(e.target)) close(); };
    const onKey = (e) => {
      if (!panel) return;
      const items = [...panel.querySelectorAll('.sm-dd-item')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); btn.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, i - 1)]?.focus(); }
    };
    const open = () => {
      panel = h('div', { class: 'sm-dd-panel', role: 'listbox' }, options.map((o) => {
        const on = o.value === value;
        return h('button', { type: 'button', role: 'option', 'aria-selected': on ? 'true' : 'false', class: on ? 'sm-dd-item on' : 'sm-dd-item',
          onclick: () => {
            close();
            btn.focus();
            if (o.value === value) return;
            value = o.value;
            paint();
            onChange(value);
          } },
          h('span', { class: 'sm-dd-check' }, on ? icon('check') : null),
          h('span', { class: 'sm-dd-name', text: o.label }),
          o.hint ? h('span', { class: 'sm-dd-hint', text: o.hint }) : null);
      }));
      root.appendChild(panel);
      btn.setAttribute('aria-expanded', 'true');
      const sel = panel.querySelector('.sm-dd-item.on') || panel.querySelector('.sm-dd-item');
      sel?.scrollIntoView({ block: 'center' });
      sel?.focus({ preventScroll: true });
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', onKey, true);
    };
    btn.addEventListener('click', () => (panel ? close() : open()));
    return root;
  }

  // ---------- Mais informações ----------
  let modalEl = null;

  function closeModal() {
    if (!modalEl) return;
    const el = modalEl;
    modalEl = null;
    setTimeout(placeSessionRow, 260);
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }

  async function openModal(item) {
    hidePreview();
    collapseCard();
    closeModal();
    noteInterest(item);
    const mode = MODES[state.mode];
    const listBtn = h('button', { type: 'button', class: 'sm-round', 'aria-label': 'Minha lista' });
    const setListIcon = () => listBtn.replaceChildren(icon(inMyList(item.id) ? 'check' : 'plus'));
    setListIcon();
    listBtn.addEventListener('click', () => { toggleMyList(item); setTimeout(setListIcon, 400); });
    const body = h('div', { class: 'sm-dlg-body' }, h('div', { class: 'sm-meta', text: 'Carregando…' }));
    // Já começou? O botão vira "Continuar" (com temporada e episódio, nas séries) e mostra a barra de progresso.
    const libItem = libraryItems().find((x) => x._id === item.id);
    const ls = libItem?.state || {};
    const started = ls.timeOffset > 0 && ls.duration > 0;
    const [, sNum, eNum] = String(ls.video_id || '').split(':');
    let playLabel = 'Assistir';
    if (item.type === 'series' && sNum && eNum && (started || ls.video_id !== `${item.id}:1:1`)) playLabel = `Continuar T${sNum}:E${eNum}`;
    else if (item.type === 'movie' && started) playLabel = 'Continuar';
    const resume = started
      ? h('div', { class: 'sm-resume' },
        h('div', { class: 'sm-card-progress' }, h('i', { style: { width: `${Math.min(100, Math.round((ls.timeOffset / ls.duration) * 100))}%` } })),
        h('span', { text: `Faltam ${Math.max(1, Math.round((ls.duration - ls.timeOffset) / 60000))} min` }))
      : null;
    const dialog = h('div', { class: 'sm-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': item.name },
      h('button', { type: 'button', class: 'sm-dlg-close', 'aria-label': 'Fechar', onclick: closeModal }, icon('close')),
      h('div', { class: 'sm-dlg-hero', style: { backgroundImage: cssUrl(item.background || cardImage(item)) } },
        h('div', { class: 'sm-dlg-info' },
          logoOrTitle(item, 'sm-hero-logo', 'sm-hero-title', 'h2'),
          h('div', { class: 'sm-actions' },
            h('button', { type: 'button', class: 'sm-btn sm-btn-white', onclick: () => play(item) }, icon('play', true), playLabel),
            listBtn,
            thumbButton(item)),
          resume)),
      body);
    const el = h('div', { id: 'sm-modal', onclick: (e) => { if (e.target === el) closeModal(); } }, dialog);
    document.body.appendChild(el);
    modalEl = el;
    requestAnimationFrame(() => el.classList.add('show'));
    dialog.querySelector('.sm-btn-white')?.focus();

    const d = await details(item.type, item.id);
    if (modalEl !== el) return;
    const info = { ...item, ...(d || {}) };
    const side = h('div', { class: 'sm-dlg-side' },
      info.cast?.length ? h('div', null, h('span', { text: 'Elenco: ' }), info.cast.join(', ')) : null,
      info.genres?.length ? h('div', null, h('span', { text: 'Gêneros: ' }), info.genres.join(', ')) : null,
      info.creators?.length ? h('div', null, h('span', { text: item.type === 'movie' ? 'Direção: ' : 'Criação: ' }), info.creators.join(', ')) : null);
    body.replaceChildren(
      h('div', { class: 'sm-dlg-cols' },
        h('div', null,
          metaLine(item, d),
          info.tagline ? h('p', { class: 'sm-dlg-tagline', text: info.tagline }) : null,
          h('p', { class: 'sm-dlg-desc', text: info.description || '' })),
        side));

    if (item.type === 'series' && d?.seasons?.length) {
      const list = h('div');
      const lib = libraryItems().find((x) => x._id === item.id);
      const saved = Number(String(lib?.state?.video_id || '').split(':')[1]);
      let curSeason = d.seasons.some((s) => s.number === saved) ? saved : d.seasons[0].number;
      const select = dropdown(
        d.seasons.map((s) => ({ value: s.number, label: s.name || `Temporada ${s.number}`, hint: `${s.episodes} ep.` })),
        curSeason,
        (v) => { curSeason = v; loadSeason(); },
        'Temporada');
      const loadSeason = async () => {
        list.replaceChildren(h('div', { class: 'sm-meta', text: 'Carregando episódios…' }));
        const eps = await season(item.id, curSeason);
        if (modalEl !== el) return;
        const curVid = lib?.state?.video_id;
        const st = lib?.state || {};
        const hasCur = eps.some((ep) => ep.id === curVid);
        const now = Date.now();
        list.replaceChildren(...eps.map((ep, i) => {
          const isCur = ep.id === curVid;
          const rel = ep.released ? new Date(ep.released).getTime() : 0;
          const isNew = rel && rel <= now && now - rel < 14 * 86400_000;
          const upcoming = rel && rel > now;
          const pct = isCur && st.timeOffset > 0 && st.duration > 0 ? Math.min(100, Math.round((st.timeOffset / st.duration) * 100)) : 0;
          return h('div', { class: `sm-ep${isCur || (!hasCur && i === 0) ? ' hl' : ''}${upcoming ? ' soon' : ''}`, role: 'button', tabindex: '0',
            onclick: () => play({ ...item, videoId: ep.id }) },
            h('div', { class: 'sm-ep-num', text: String(ep.episode) }),
            h('div', { class: 'sm-ep-img', style: ep.still ? { backgroundImage: cssUrl(ep.still) } : null }, icon('play', true),
              pct ? h('div', { class: 'sm-card-progress' }, h('i', { style: { width: `${pct}%` } })) : null),
            h('div', null,
              h('div', { class: 'sm-ep-top' },
                h('span', { text: ep.name }),
                h('span', { class: 'sm-ep-right' },
                  isNew ? h('b', { class: 'sm-ep-tag', text: 'NOVO' }) : null,
                  upcoming ? h('b', { class: 'sm-ep-tag soon', text: `Estreia ${new Date(rel).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` }) : null,
                  ep.runtime ? h('span', { text: `${ep.runtime}min` }) : null)),
              isCur && pct ? h('div', { class: 'sm-ep-cont', text: `Continuar · faltam ${Math.max(1, Math.round((st.duration - st.timeOffset) / 60000))} min` }) : null,
              h('p', { class: 'sm-ep-desc', text: ep.description || '' })));
        }));
      };
      body.appendChild(h('div', { class: 'sm-dlg-section' },
        h('div', { class: 'sm-dlg-section-head' }, h('h3', { text: 'Episódios' }), select), list));
      loadSeason();
    }

    const sims = profileFilter(await similar(mode.provider, item.type, item.id));
    if (modalEl !== el || !sims.length) return;
    body.appendChild(h('div', { class: 'sm-dlg-section' },
      h('h3', { text: 'Títulos semelhantes', style: { marginBottom: '1rem' } }),
      h('div', { class: 'sm-similar' }, sims.slice(0, 9).map((s) =>
        h('div', { class: 'sm-sim', role: 'button', tabindex: '0', onclick: () => openModal(s) },
          h('div', { class: 'sm-sim-img', style: { backgroundImage: cssUrl(cardImage(s)) } }, icon('play', true),
            ranks.get(s.id) ? h('div', { class: 'sm-sim-rank' }, top10Chip()) : null,
            !ranks.get(s.id) && Number(s.releaseInfo) >= new Date().getFullYear() ? h('div', { class: 'sm-sim-new', text: 'NOVIDADE' }) : null),
          h('div', { class: 'sm-sim-body' },
            h('div', { class: 'sm-sim-name', text: s.name }),
            h('div', { class: 'sm-meta', style: { margin: '.4rem 0 0' } },
              s.rating ? h('span', { class: 'sm-match', text: `${Math.round(s.rating * 10)}% relevante` }) : null,
              s.releaseInfo ? h('span', { text: s.releaseInfo }) : null),
            s.description ? h('p', { text: s.description }) : null))))));
  }

  // ---------- Busca (layout da Netflix na TV) ----------
  // Esquerda: campo de busca e uma lista que começa com as categorias e vira sugestões enquanto você digita.
  // Direita: as capas.
  const SEARCH_CATEGORIES = ['Terror', 'Comédia', 'Ação', 'Drama', 'Romance', 'Suspense', 'Policial', 'Ficção científica',
    'Fantasia', 'Documentários', 'Anime', 'Animação', 'Família', 'Reality shows', 'Brasileiros', 'Mistério', 'Guerra', 'Faroeste'];
  const normText = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // fromTyping: atualiza a rota sem empilhar uma entrada no histórico a cada letra.
  function goSearch(text, fromTyping = false) {
    const q = String(text || '').trim();
    const hash = q ? `#/search?search=${encodeURIComponent(q)}` : '#/search';
    if (searchQuery() !== null && fromTyping) {
      history.replaceState(history.state, '', hash);
      schedule();
    } else location.hash = hash;
  }

  let searchSeq = 0;
  let lastSuggestions = [];

  function buildSearchLayout() {
    const input = h('input', { type: 'text', class: 'sm-sp-input', placeholder: 'Buscar títulos, gente e gêneros',
      'aria-label': 'Buscar', autocomplete: 'off', spellcheck: 'false' });
    const clear = h('button', { type: 'button', class: 'sm-sp-clear', 'aria-label': 'Limpar busca', hidden: true,
      onclick: () => { input.value = ''; onType(); input.focus(); } }, icon('close'));
    const label = h('div', { class: 'sm-sp-label' });
    const list = h('ul', { class: 'sm-sp-list', role: 'listbox' });
    const title = h('h2', { class: 'sm-sp-title' });
    const results = h('div', { class: 'sm-sp-results' });
    const wrap = h('div', { class: 'sm-searchpage' },
      h('aside', { class: 'sm-sp-side' },
        h('div', { class: 'sm-sp-box' }, icon('search'), input, clear),
        label, list),
      h('section', { class: 'sm-sp-main' }, title, results));

    let typing = null;
    function onType() {
      clear.hidden = !input.value;
      renderSuggestions(wrap, input.value); // resposta instantânea com o que já sabemos
      clearTimeout(typing);
      typing = setTimeout(() => goSearch(input.value, true), 300);
    }
    input.addEventListener('input', onType);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { clearTimeout(typing); goSearch(input.value, true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); list.querySelector('button')?.focus(); }
      else if (e.key === 'Escape') {
        e.stopPropagation();
        if (input.value) { input.value = ''; onType(); } else location.hash = '#/';
      }
    });
    list.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('button')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, i + 1)]?.focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : items[i - 1]).focus(); }
      if (e.key === 'Escape') { e.stopPropagation(); input.focus(); }
    });
    Object.assign(wrap, { __input: input, __clear: clear, __label: label, __list: list, __title: title, __results: results });
    return wrap;
  }

  // Lista da esquerda. Vazia: categorias. Digitando: categorias que batem + últimas sugestões do servidor que ainda batem.
  function renderSuggestions(wrap, text, serverTerms) {
    const q = normText(text);
    let terms;
    let label;
    if (!q) {
      terms = SEARCH_CATEGORIES;
      label = 'Categorias';
    } else {
      if (serverTerms) lastSuggestions = serverTerms;
      const local = SEARCH_CATEGORIES.filter((c) => normText(c).startsWith(q));
      const fromServer = lastSuggestions.filter((t) => serverTerms || normText(t).includes(q));
      terms = [...new Set([...local, ...fromServer])].slice(0, 12);
      label = terms.length ? 'Sugestões' : '';
    }
    wrap.__label.textContent = label;
    const current = normText(wrap.__input.value);
    wrap.__list.replaceChildren(...terms.map((t) => {
      const name = h('span');
      // Destaca a parte que você já digitou.
      const n = normText(t);
      const at = q ? n.indexOf(q) : -1;
      if (at >= 0) name.append(t.slice(0, at), h('b', { text: t.slice(at, at + q.length) }), t.slice(at + q.length));
      else name.textContent = t;
      return h('li', null, h('button', { type: 'button', class: normText(t) === current ? 'sm-sp-item on' : 'sm-sp-item',
        onclick: () => {
          wrap.__input.value = t;
          wrap.__clear.hidden = false;
          goSearch(t, true);
          wrap.__input.focus();
        } }, name));
    }));
  }

  // Feed infinito da busca vazia: cada página é um bloco ("Para quem curte documentários de crime"...).
  function loadForYou(wrap, feed, seq, mode) {
    const seeds = seedsParam();
    const shown = new Set();
    let page = 0;
    let busy = false;
    let done = false;
    let emptyStreak = 0;
    const sentinel = h('div', { class: 'sm-feed-more' }, h('div', { class: 'sm-grid' },
      Array.from({ length: 5 }, () => h('div', { class: 'sm-card sm-ghost' }))));
    feed.appendChild(sentinel);
    const stopped = () => seq !== searchSeq || !app || !feed.isConnected;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) next(); },
      { root: app, rootMargin: '900px 0px' });
    async function next() {
      if (busy || done) return;
      if (stopped()) return io.disconnect();
      busy = true;
      try {
        const data = await addon(`/sm/foryou/${mode.provider}/${page}.json?seeds=${encodeURIComponent(seeds)}`);
        page++;
        if (stopped()) return io.disconnect();
        if (data.done) { done = true; sentinel.remove(); io.disconnect(); return; }
        const fresh = profileFilter(data.metas || []).filter((m) => !shown.has(m.id));
        // Bloco com pouca coisa nova (já apareceu antes) não vale uma seção própria.
        if (fresh.length >= 4) {
          emptyStreak = 0;
          fresh.forEach((m) => shown.add(m.id));
          feed.insertBefore(h('section', { class: 'sm-feed-block' },
            h('h2', { class: 'sm-sp-title', text: data.title }),
            h('div', { class: 'sm-grid sm-results' }, fresh.map((it) => card(it)))), sentinel);
        } else if (++emptyStreak > 8) { done = true; sentinel.remove(); io.disconnect(); return; }
      } catch {
        if (!page) feed.replaceChildren(h('div', { class: 'sm-offline', text:
          offlineText() }));
        done = true;
        io.disconnect();
        return;
      } finally {
        busy = false;
      }
      // Continua enchendo enquanto o fim ainda estiver à vista.
      const r = sentinel.getBoundingClientRect();
      if (!done && r.top < window.innerHeight + 900) next();
    }
    io.observe(sentinel);
    next();
  }

  function renderSearch() {
    if (!app) return;
    const mode = MODES[state.mode];
    let wrap = app.querySelector('.sm-searchpage');
    if (!wrap) {
      wrap = buildSearchLayout();
      app.appendChild(wrap);
      setTimeout(() => {
        const a = document.activeElement;
        if (a && a !== document.body && !app?.contains(a)) return;
        wrap.__input.focus();
        wrap.__input.setSelectionRange(wrap.__input.value.length, wrap.__input.value.length);
      }, 0);
    }
    const input = wrap.__input;
    if (document.activeElement !== input && input.value !== state.query) input.value = state.query || '';
    wrap.__clear.hidden = !input.value;

    const q = (state.query || '').trim();
    const seq = ++searchSeq;
    hidePreview();
    renderSuggestions(wrap, input.value);
    const ghosts = () => h('div', { class: 'sm-grid', 'aria-busy': 'true' },
      Array.from({ length: 12 }, () => h('div', { class: 'sm-card sm-ghost' })));
    const offline = () => h('div', { class: 'sm-offline', text:
      offlineText() });

    if (!q) {
      // Sem texto: recomendações a partir do que você assiste, carregando mais ao descer.
      wrap.__title.textContent = '';
      const feed = h('div', { class: 'sm-feed' });
      wrap.__results.replaceChildren(feed);
      loadForYou(wrap, feed, seq, mode);
      return;
    }

    wrap.__title.textContent = `Resultados para "${q}"`;
    wrap.__results.replaceChildren(ghosts());
    addon(`/sm/search/${mode.provider}.json?q=${encodeURIComponent(q)}`).then((data) => {
      if (seq !== searchSeq || !app) return;
      const metas = profileFilter(data.metas || []);
      if (data.genre) wrap.__title.textContent = q;
      if (normText(input.value) === normText(q)) renderSuggestions(wrap, input.value, data.suggestions || []);
      if (!metas.length) {
        wrap.__results.replaceChildren(h('div', { class: 'sm-noresults' },
          h('p', { text: `Sua busca por "${q}" não encontrou resultados na ${mode.label}.` }),
          h('p', { text: 'Sugestões:' }),
          h('ul', null,
            h('li', { text: 'Tente palavras diferentes' }),
            h('li', { text: 'Procure por um filme, série, ator ou diretor' }),
            h('li', { text: 'Escolha uma das categorias ao lado' }))));
        return;
      }
      const grid = h('div', { class: 'sm-grid sm-results' }, metas.map((it) => card(it)));
      wrap.__results.replaceChildren(grid);
      infiniteGrid(grid, (page) => addon(`/sm/search/${mode.provider}/${page + 1}.json?q=${encodeURIComponent(q)}`),
        { seen: metas.map((m) => m.id), stop: () => seq !== searchSeq });
    }).catch(() => {
      if (seq === searchSeq) wrap.__results.replaceChildren(offline());
    });
  }

  // Rodapé de fim de lista, como o loop da TV: volta ao topo.
  function endFooter(text = 'Você viu tudo por aqui.') {
    return h('div', { class: 'sm-end' },
      h('p', { text }),
      h('button', { type: 'button', class: 'sm-btn sm-btn-white', onclick: () => app?.scrollTo({ top: 0, behavior: 'smooth' }) },
        icon('up'), 'Voltar ao início'));
  }

  // ---------- Grade que carrega mais ao descer (busca, Explorar tudo) ----------
  // loadPage(n) devolve { metas, more }. n começa em 0.
  function infiniteGrid(grid, loadPage, { seen = [], stop = () => false } = {}) {
    const shown = new Set(seen);
    let page = 0;
    let busy = false;
    let done = false;
    let empty = 0;
    const sentinel = h('div', { class: 'sm-feed-more' }, h('div', { class: 'sm-grid' },
      Array.from({ length: 5 }, () => h('div', { class: 'sm-card sm-ghost' }))));
    grid.after(sentinel);
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) next(); }, { root: app, rootMargin: '900px 0px' });
    const end = () => {
      if (done) return;
      done = true;
      io.disconnect();
      // Chegou ao fim de verdade (não foi interrompido por troca de página): mostra o rodapé.
      if (!stop() && grid.isConnected && grid.childElementCount > 10) sentinel.replaceWith(endFooter());
      else sentinel.remove();
    };
    async function next() {
      if (busy || done) return;
      if (stop() || !grid.isConnected) return end();
      busy = true;
      try {
        const data = await loadPage(page++);
        if (stop() || !grid.isConnected) return end();
        const fresh = profileFilter(data.metas || []).filter((m) => !shown.has(m.id));
        for (const m of fresh) { shown.add(m.id); grid.appendChild(card(m)); }
        if (!data.more) return end();
        if (fresh.length) empty = 0;
        else if (++empty > 2) return end();
      } catch {
        return end();
      } finally {
        busy = false;
      }
      if (!done && sentinel.getBoundingClientRect().top < window.innerHeight + 900) next();
    }
    io.observe(sentinel);
    next();
  }

  // ---------- Explorar tudo ----------
  function openExplore(c, title) {
    hidePreview();
    collapseCard();
    if (state.page !== 'explore') state.explorePrev = state.page;
    state.explore = { type: c.type, id: c.id, title };
    state.page = 'explore';
    renderPage();
    app.scrollTop = 0;
  }

  function renderExplore() {
    const ex = state.explore;
    if (!ex) { state.page = 'home'; return renderPage(); }
    const grid = h('div', { class: 'sm-grid sm-results' });
    const back = () => setPage(state.explorePrev || 'home');
    app.appendChild(h('div', { class: 'sm-rows flat sm-explorepage' },
      h('div', { class: 'sm-explore-head' },
        h('button', { type: 'button', class: 'sm-back', 'aria-label': 'Voltar', title: 'Voltar (Esc)', onclick: back }, icon('left')),
        h('h1', { class: 'sm-page-title', text: ex.title })),
      grid));
    infiniteGrid(grid, (page) =>
      addon(`/catalog/${ex.type}/${encodeURIComponent(ex.id)}${page ? `/skip=${page * 20}` : ''}.json`)
        .then((d) => ({ metas: d.metas || [], more: (d.metas || []).length > 0 })),
    { stop: () => state.page !== 'explore' || state.explore !== ex });
  }

  // ---------- Home sem fim: fileiras pelos seus gostos e, no final, voltar ao início ----------
  function appendForYouRows(container, mode, typeFilter) {
    if (!['home', 'series', 'movies'].includes(state.page)) return;
    const seeds = seedsParam();
    const titles = new Set([...container.querySelectorAll('.sm-row-title')].map((t) => t.textContent));
    const sentinel = h('div', { class: 'sm-home-more' });
    container.appendChild(sentinel);
    let page = 0;
    let added = 0;
    let busy = false;
    let done = false;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) next(); }, { root: app, rootMargin: '1400px 0px' });
    async function next() {
      if (busy || done) return;
      if (!sentinel.isConnected) { io.disconnect(); return; }
      busy = true;
      try {
        const data = await addon(`/sm/foryou/${mode.provider}/${page++}.json?seeds=${encodeURIComponent(seeds)}`);
        if (!sentinel.isConnected) { io.disconnect(); return; }
        if (data.done) done = true;
        else {
          const metas = profileFilter(data.metas || []).filter((m) => !typeFilter || m.type === typeFilter);
          if (metas.length >= 6 && !titles.has(data.title)) {
            titles.add(data.title);
            const row = makeRow(data.title, () => Promise.resolve(metas));
            container.insertBefore(row, sentinel);
            row.__load();
            added++;
          }
        }
        if (added >= 14 || page > 40) done = true;
      } catch {
        done = true;
      } finally {
        busy = false;
      }
      if (done) {
        io.disconnect();
        sentinel.replaceWith(endFooter());
        return;
      }
      if (sentinel.getBoundingClientRect().top < window.innerHeight + 1400) next();
    }
    io.observe(sentinel);
  }

  // ---------- Novidades e populares ----------
  const reminders = () => store.get('reminders') || [];
  const isReminded = (id) => reminders().some((r) => r.id === id);
  function toggleReminder(it) {
    const list = reminders();
    const next = list.some((r) => r.id === it.id)
      ? list.filter((r) => r.id !== it.id)
      : [...list, { id: it.id, type: it.type, name: it.name, date: it.date, background: it.background, logo: it.logo, description: it.description }];
    store.set('reminders', next.slice(-100));
  }

  // Novidades e populares no layout da Netflix no computador: fileiras, como a Home.
  function renderNews() {
    const mode = MODES[state.mode];
    const p = mode.provider;
    const rows = h('div', { class: 'sm-rows flat sm-newspage' }, h('h1', { class: 'sm-page-title', text: 'Novidades e populares' }));
    app.appendChild(rows);
    rowObserver?.disconnect();
    rowObserver = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { rowObserver.unobserve(e.target); e.target.__load?.(); }
    }, { root: app, rootMargin: '600px 0px' });
    const add = (row) => { rows.appendChild(row); rowObserver.observe(row); };

    const soon = addon(`/sm/upcoming/${p}.json`).then((d) => d.items || []).catch(() => []);
    const daysUntil = (it) => Math.round((new Date(`${it.date}T12:00:00`) - new Date(new Date().toDateString())) / 86400_000);
    const upRow = (title, test) => makeRow(title, () => soon.then((list) => list.filter((it) => test(daysUntil(it)))),
      { render: (it) => upcomingCard(it) });

    add(makeRow('Novidades na Netflix', () =>
      Promise.all([catalog('series', `${p}.new-series`), catalog('movie', `${p}.new-movies`)].map((x) => x.catch(() => [])))
        .then(([sr, mv]) => {
          const out = [];
          for (let i = 0; i < Math.max(sr.length, mv.length); i++) { if (sr[i]) out.push(sr[i]); if (mv[i]) out.push(mv[i]); }
          return out;
        })));
    add(upRow('Chegando esta semana', (d) => d >= 0 && d <= 7));
    add(makeRow('Top 10 séries no Brasil esta semana', () => catalog('series', `${p}.top10-series`), { rank: true }));
    add(upRow('Chegando na próxima semana', (d) => d > 7 && d <= 14));
    add(makeRow('Top 10 filmes no Brasil esta semana', () => catalog('movie', `${p}.top10-movies`), { rank: true }));
    add(upRow('Vale a espera', (d) => d > 14));
    add(makeRow('Bombando agora', () =>
      Promise.all([catalog('series', `${p}.trending-series`), catalog('movie', `${p}.trending-movies`)].map((x) => x.catch(() => [])))
        .then(([sr, mv]) => {
          const out = [];
          for (let i = 0; i < 20; i++) { if (sr[i]) out.push(sr[i]); if (mv[i]) out.push(mv[i]); }
          return out;
        })));
  }

  // "Chega sexta-feira", "Chega amanhã", "Chega em 12 de dez."
  function arrivalLabel(date) {
    const when = new Date(`${date}T12:00:00`);
    const d = Math.round((when - new Date(new Date().toDateString())) / 86400_000);
    if (d <= 0) return 'Chega hoje';
    if (d === 1) return 'Chega amanhã';
    if (d < 7) return `Chega ${when.toLocaleDateString('pt-BR', { weekday: 'long' })}`;
    return `Chega em ${when.getDate()} de ${when.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}`;
  }

  function reminderButton(it, cls, withText) {
    const btn = h('button', { type: 'button', class: cls });
    const paint = () => {
      const on = isReminded(it.id);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-label', on ? 'Lembrete ativo' : 'Lembrar-me');
      btn.title = on ? 'Lembrete ativo (clique para remover)' : 'Lembrar-me';
      btn.replaceChildren(icon(on ? 'check' : 'bell'), withText ? h('span', { text: on ? 'Lembrete ativo' : 'Lembrar-me' }) : null);
    };
    paint();
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleReminder(it); paint(); });
    return btn;
  }

  // Capa de estreia: data no canto, "Chega sexta-feira" embaixo e o sininho de lembrete.
  function upcomingCard(it) {
    const when = new Date(`${it.date}T12:00:00`);
    const el = h('div', { class: 'sm-card sm-up', tabindex: '0', role: 'button', 'aria-label': `${it.name}, ${arrivalLabel(it.date)}`,
      style: { backgroundImage: cssUrl(it.poster || it.background) } },
    h('div', { class: 'sm-up-date' },
      h('b', { text: String(when.getDate()) }),
      h('span', { text: when.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() })),
    logoOrTitle(it, 'sm-card-logo', 'sm-card-name'),
    h('div', { class: 'sm-up-label', text: arrivalLabel(it.date) }),
    reminderButton(it, 'sm-up-bell', false));
    el.addEventListener('click', () => openUpcoming(it));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') openUpcoming(it); });
    return el;
  }

  // Janela de uma estreia (ainda não dá para assistir): data, tipo, sinopse e "Lembrar-me".
  function openUpcoming(it) {
    hidePreview();
    collapseCard();
    closeModal();
    const when = new Date(`${it.date}T12:00:00`);
    const playable = /^tt\d+$/.test(it.id);
    const dialog = h('div', { class: 'sm-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': it.name },
      h('button', { type: 'button', class: 'sm-dlg-close', 'aria-label': 'Fechar', onclick: closeModal }, icon('close')),
      h('div', { class: 'sm-dlg-hero', style: { backgroundImage: cssUrl(it.background) } },
        h('div', { class: 'sm-dlg-info' },
          logoOrTitle(it, 'sm-hero-logo', 'sm-hero-title', 'h2'),
          h('div', { class: 'sm-actions' },
            reminderButton(it, 'sm-btn sm-btn-white sm-remind', true),
            playable ? h('button', { type: 'button', class: 'sm-btn sm-btn-gray', onclick: () => openModal(it) }, icon('info'), 'Mais informações') : null))),
      h('div', { class: 'sm-dlg-body' },
        h('div', { class: 'sm-up-when' },
          h('b', { text: arrivalLabel(it.date) }),
          h('span', { text: ` · ${when.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}` })),
        h('div', { class: 'sm-meta' }, h('span', { class: 'sm-up-kind', text: it.kind || (it.type === 'movie' ? 'Filme' : 'Série') }),
          ...(it.genres || []).map((g) => h('span', { text: g }))),
        it.description ? h('p', { class: 'sm-dlg-desc', text: it.description }) : null));
    const el = h('div', { id: 'sm-modal', onclick: (e) => { if (e.target === el) closeModal(); } }, dialog);
    document.body.appendChild(el);
    modalEl = el;
    requestAnimationFrame(() => el.classList.add('show'));
  }

  // ---------- Player no estilo Netflix ----------
  // "Pular abertura" (animes pela AniSkip; séries: o plugin aprende quando você pula a abertura na mão)
  // e "Próximo episódio" com contagem regressiva no fim. Só no modo streaming.
  let playerCtl = null;
  let playerKey = null;

  function playerRoute() {
    const m = location.hash.match(/^#\/player\/([^/?]+)(?:\/([^/?]*))?(?:\/([^/?]*))?(?:\/([^/?]*))?(?:\/([^/?]*))?(?:\/([^/?]*))?/);
    if (!m) return null;
    const dec = (v) => { try { return v ? decodeURIComponent(v) : null; } catch { return null; } };
    return { type: dec(m[4]), id: dec(m[5]), videoId: dec(m[6]) };
  }

  function syncPlayer() {
    const r = MODES[state.mode].provider ? playerRoute() : null;
    const key = r ? location.hash : null;
    if (key === playerKey) return;
    playerCtl?.destroy();
    playerCtl = null;
    playerKey = key;
    if (r) playerCtl = createPlayerCtl(r);
  }

  const introMarks = () => store.get('introMarks') || {};

  function createPlayerCtl(route) {
    const m = String(route.videoId || '').match(/^(tt\d+):(\d+):(\d+)$/);
    const ep = m ? { id: m[1], season: Number(m[2]), episode: Number(m[3]) } : null;
    const root = h('div', { id: 'sm-player' });
    document.body.appendChild(root);
    let video = null;
    let skip = null; // { intro:[a,b], outro:[a,b] }
    let next = null;
    let dismissed = false;
    let countdown = null;
    let lastTime = 0;
    let stopped = false;
    let skipBtn = null;
    let nextCard = null;

    const findVideo = setInterval(() => {
      const v = document.querySelector('[class*="video-container"] video');
      if (v && v !== video) attach(v);
    }, 500);

    function attach(v) {
      video?.removeEventListener('timeupdate', onTime);
      video?.removeEventListener('seeked', onSeeked);
      video = v;
      v.addEventListener('timeupdate', onTime);
      v.addEventListener('seeked', onSeeked);
      const load = () => {
        if (!ep || stopped) return;
        const len = Math.round(v.duration || 0);
        addon(`/sm/skip/${ep.id}/${ep.season}/${ep.episode}.json?len=${len}`).then((d) => { skip = d; }).catch(() => {});
        addon(`/sm/next/${ep.id}/${ep.season}/${ep.episode}.json`).then((d) => { next = d.next; }).catch(() => {});
      };
      if (v.readyState >= 1) load();
      else v.addEventListener('loadedmetadata', load, { once: true });
    }

    // Aprende a abertura: pulo manual para frente de 20 s a 2,5 min nos primeiros 10 min do episódio.
    function onSeeked() {
      if (!ep || !video) return;
      const from = lastTime;
      const to = video.currentTime;
      if (from < 600 && to - from >= 20 && to - from <= 150 && !skip?.intro) {
        const marks = introMarks();
        marks[ep.id] = { start: Math.max(0, from - 3), end: to };
        store.set('introMarks', marks);
      }
      lastTime = to;
    }

    function introWindow() {
      if (skip?.intro) return skip.intro;
      const mark = ep && introMarks()[ep.id];
      return mark ? [mark.start, mark.end] : null;
    }

    function onTime() {
      if (!video || stopped) return;
      const t = video.currentTime;
      const d = video.duration || 0;
      if (!video.seeking) lastTime = t;
      const intro = introWindow();
      showSkip(Boolean(intro && t >= intro[0] && t < intro[1] - 1), intro);
      // Fim do episódio: começo do encerramento (AniSkip) ou os últimos 30 s.
      const endAt = skip?.outro ? skip.outro[0] : d - 30;
      const atEnd = next && d > 300 && t >= endAt && t < d - 0.5;
      showNext(Boolean(atEnd && !dismissed));
      if (!atEnd && t < endAt - 5) dismissed = false;
    }

    function showSkip(on, intro) {
      if (on && !skipBtn) {
        skipBtn = h('button', { type: 'button', class: 'sm-skip', onclick: () => { if (video && intro) video.currentTime = intro[1]; } },
          'Pular abertura');
        root.appendChild(skipBtn);
        requestAnimationFrame(() => skipBtn?.classList.add('show'));
      } else if (!on && skipBtn) {
        const b = skipBtn;
        skipBtn = null;
        b.classList.remove('show');
        setTimeout(() => b.remove(), 250);
      }
    }

    function goNext() {
      clearInterval(countdown);
      const native = [...document.querySelectorAll('[class*="control-bar-button"]')].find((b) => /next/i.test(b.getAttribute('title') || ''));
      if (native) native.click(); // usa a lógica do Stremio (mesma fonte, mesma qualidade)
      else if (next) location.hash = `#/detail/series/${ep.id}/${encodeURIComponent(next.id)}`;
    }

    function showNext(on) {
      if (on && !nextCard && next) {
        const fill = h('i', { class: 'sm-next-fill' });
        nextCard = h('div', { class: 'sm-next' },
          h('div', { class: 'sm-next-info' },
            next.thumbnail ? h('div', { class: 'sm-next-thumb', style: { backgroundImage: cssUrl(next.thumbnail) } }) : null,
            h('div', null,
              h('div', { class: 'sm-next-label', text: 'Próximo episódio' }),
              h('div', { class: 'sm-next-title', text: `T${next.season}:E${next.episode} · ${next.title}` }))),
          h('div', { class: 'sm-next-actions' },
            h('button', { type: 'button', class: 'sm-next-credits', onclick: () => { dismissed = true; showNext(false); } }, 'Assistir aos créditos'),
            h('button', { type: 'button', class: 'sm-next-go', onclick: goNext }, fill, icon('play', true), h('span', { text: 'Próximo episódio' }))));
        root.appendChild(nextCard);
        requestAnimationFrame(() => nextCard?.classList.add('show'));
        // Contagem regressiva de 10 s (como na Netflix); depois toca o próximo.
        const startAt = Date.now();
        clearInterval(countdown);
        countdown = setInterval(() => {
          const pct = Math.min(1, (Date.now() - startAt) / 10_000);
          fill.style.width = `${pct * 100}%`;
          if (pct >= 1) goNext();
        }, 100);
      } else if (!on && nextCard) {
        clearInterval(countdown);
        const c = nextCard;
        nextCard = null;
        c.classList.remove('show');
        setTimeout(() => c.remove(), 250);
      }
    }

    return {
      destroy() {
        stopped = true;
        clearInterval(findVideo);
        clearInterval(countdown);
        video?.removeEventListener('timeupdate', onTime);
        video?.removeEventListener('seeked', onSeeked);
        root.remove();
      },
    };
  }

  // ---------- Minha lista ----------
  function renderMyList() {
    const items = myList().map(fromLibrary);
    const wrap = h('div', { class: 'sm-rows flat' }, h('h1', { class: 'sm-page-title', text: 'Minha lista' }));
    if (!items.length) wrap.appendChild(h('div', { class: 'sm-empty', text: 'Sua lista está vazia. Use o botão + nos títulos para adicionar.' }));
    else wrap.appendChild(h('div', { class: 'sm-grid' }, items.map((it) => card(it))));
    app.appendChild(wrap);
  }

  // ===========================================================================
  // Loop principal
  // ===========================================================================
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      try {
        tagRows();
        ensureSwitchers();
        syncAppVisibility();
        syncPlayer();
      } catch (err) {
        console.error('[Streaming Modes]', err);
      }
    });
  }

  function start() {
    injectStyles();
    Object.keys(MODES).forEach(checkLocalIntro);
    applyRootAttrs();
    if (MODES[state.mode].provider) rebuildApp();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', schedule);
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (popEl) return closePop();
        if (menuEl) return closeMenu();
        if (modalEl) return closeModal();
        if (state.page === 'explore' && !popEl) return setPage(state.explorePrev || 'home');
      }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        const anchor = [...document.querySelectorAll('.sm-switch')].find((b) => b.offsetParent !== null);
        if (menuEl) closeMenu();
        else if (anchor) openMenu(anchor);
        else {
          const keys = Object.keys(MODES);
          switchMode(keys[(keys.indexOf(state.mode) + 1) % keys.length]);
        }
      }
    });
    schedule();
    console.info('[Streaming Modes] carregado. Modo atual:', state.mode);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
