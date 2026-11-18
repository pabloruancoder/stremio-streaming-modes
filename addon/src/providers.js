// Cada streaming vira um "modo". Para adicionar outro serviço, crie uma entrada aqui
// (IDs de provedor/rede do TMDB) e um tema correspondente no plugin.
//
// IDs úteis de provedor no TMDB (watch providers, região BR):
//   Netflix 8 · Prime Video 119 · Disney+ 337 · Max 1899 · Apple TV+ 350 · Globoplay 307
export const PROVIDERS = {
  netflix: {
    key: 'netflix',
    label: 'Netflix',
    tmdbProviderId: 8,
    tmdbNetworkId: 213, // rede "Netflix" = séries originais
    hasOfficialTop10: true,
  },
  disney: {
    key: 'disney',
    label: 'Disney+',
    prep: 'no', // "Só no ..."
    tmdbProviderId: 337,
    tmdbNetworkId: 2739, // rede "Disney+" = séries originais
    hasOfficialTop10: false, // a Disney+ não publica ranking
    freshDays: { movie: 120, series: 90 }, // lança bem menos que a Netflix: janela maior em "Lançamentos"
    // "Em breve": séries das redes que estão na Disney+ no Brasil (Disney+, Hulu, FX, FXX, National Geographic),
    // estreias digitais e próximos filmes dos estúdios nos cinemas, nos próximos 6 meses.
    // Filmes originais: estúdios Disney (Disney, Pixar, Marvel, Lucasfilm, Animation, 20th Century, Searchlight,
    // National Geographic, Disney Television Animation, Disney Channel) lançados desde a estreia da Disney+.
    originalMovies: { companies: '2|3|420|1|6125|127928|43|7521|3475|670|114038', since: '2019-11-12' },
    kidsRows: [
      { id: 'kids-disney-movies', type: 'movie', name: 'Filmes Disney e Pixar para crianças',
        params: { with_companies: '2|3|6125', certification_country: 'BR', certification: 'L|10' } },
      { id: 'kids-disneyjr-series', type: 'series', name: 'Disney Channel e Disney Junior',
        params: { with_networks: '54|281|44', without_genres: '80,27' } },
    ],
    upcoming: { days: 180, networks: '2739|453|88|1035|43', movieCompanies: '2|3|420|1|127928|43|7521|6125' },
    // Marcas da tela inicial (filtros do TMDB dentro do catálogo da Disney+ Brasil). Fora dos EUA, Star virou Hulu (out/2025).
    brands: [
      { id: 'disney', name: 'Disney', movie: { with_companies: '2|6125' }, series: { with_companies: '2|6125|3475|670' } },
      { id: 'pixar', name: 'Pixar', movie: { with_companies: '3' }, series: { with_companies: '3' } },
      { id: 'marvel', name: 'Marvel', movie: { with_companies: '420|7505' }, series: { with_companies: '420|7505|13252|38679' } },
      { id: 'starwars', name: 'Star Wars', movie: { with_companies: '1' }, series: { with_companies: '1' } },
      { id: 'natgeo', name: 'National Geographic', movie: { with_companies: '7521|114038' }, series: { with_networks: '43|1043|799' } },
      { id: 'hulu', name: 'Hulu', movie: { with_companies: '127928|25|43' }, series: { with_networks: '88|453|1035' } },
    ],
  },
  // Apple TV (o Apple TV+ passou a se chamar só "Apple TV" em out/2025). Catálogo quase todo original.
  apple: {
    key: 'apple',
    label: 'Apple TV',
    prep: 'no', // "Só no ..."
    tmdbProviderId: 350,
    tmdbNetworkId: 2552, // rede "Apple TV" = séries originais
    hasOfficialTop10: false,
    cardShape: 'poster', // no app (tvOS 26) as fileiras usam pôsteres na vertical
    freshDays: { movie: 240, series: 180 }, // lança pouco: janela maior em "Lançamentos"
    // Filmes originais = Apple Studios. Na Apple, até os que passaram nos cinemas (F1, Napoleão) são originais.
    originalMovies: { companies: '194232', since: '2019-11-01', allowTheatrical: true },
    upcoming: { days: 180, networks: '2552', movieCompanies: '194232' },
  },
  prime: {
    key: 'prime',
    label: 'Prime Video',
    prep: 'no', // "Só no ..."
    tmdbProviderId: 119,
    tmdbNetworkId: 1024, // rede "Prime Video" = séries originais
    hasOfficialTop10: false,
    // Filmes originais: Amazon Studios e Amazon MGM Studios (inclui os que passaram nos cinemas).
    originalMovies: { companies: '20580|210099', since: '2016-01-01', allowTheatrical: true },
    freshDays: { movie: 90, series: 60 },
    // Em breve: só idiomas que costumam chegar ao Brasil (a Amazon tem muitos originais regionais).
    upcoming: { days: 180, networks: '1024', movieCompanies: '20580|210099', langs: ['en', 'pt', 'es', 'fr', 'it', 'de', 'ko'] },
  },
  // HBO Max (voltou a se chamar assim em 2025, depois de "Max").
  hbo: {
    key: 'hbo',
    label: 'HBO Max',
    prep: 'na',
    tmdbProviderId: 1899,
    tmdbNetworkId: '49|3186|6783|8304', // HBO, HBO Max e Max = originais
    hasOfficialTop10: false,
    freshDays: { movie: 120, series: 60 },
    // Marcas (página "Categorias" do app): HBO, DC, Warner Bros., Cartoon Network, Adult Swim e Discovery.
    brands: [
      { id: 'hbo', name: 'HBO', movie: { with_companies: '7429|14914' }, series: { with_networks: '49' } },
      { id: 'maxorig', name: 'Max Originals', movie: { 'vote_count.gte': 999999 }, series: { with_networks: '3186|6783|8304' } },
      { id: 'id', name: 'Investigation Discovery', movie: { 'vote_count.gte': 999999 }, series: { with_networks: '244' } },
      { id: 'tlc', name: 'TLC', movie: { 'vote_count.gte': 999999 }, series: { with_networks: '84' } },
      { id: 'tcm', name: 'TCM', movie: { 'primary_release_date.lte': '1969-12-31' }, series: { 'vote_count.gte': 999999 } },
      { id: 'sesame', name: 'Sesame Workshop', movie: { with_companies: '3673' }, series: { with_companies: '3673' } },
      { id: 'hgtv', name: 'HGTV', movie: { 'vote_count.gte': 999999 }, series: { with_networks: '210' } },
      { id: 'harrypotter', name: 'Harry Potter', movie: { with_companies: '437' }, series: { 'vote_count.gte': 999999 } },
      { id: 'dc', name: 'DC', movie: { with_companies: '9993|128064|184898|429' }, series: { with_companies: '9993|184898|429' } },
      { id: 'wb', name: 'Warner Bros.', movie: { with_companies: '174' }, series: { with_companies: '1957' } },
      { id: 'cn', name: 'Cartoon Network', movie: { with_companies: '7899|2785' }, series: { with_networks: '56' } },
      { id: 'adultswim', name: 'Adult Swim', movie: { with_companies: '7899', 'vote_count.gte': 99999 }, series: { with_networks: '80' } },
      { id: 'discovery', name: 'Discovery', movie: { with_genres: '99' }, series: { with_networks: '64|91|244|84' } },
    ],
    upcoming: { days: 180, networks: '49|3186|6783|8304', movieCompanies: '174|9993|184898|7429', langs: ['en', 'pt', 'es', 'fr', 'it', 'de', 'ko'] },
  },
  globoplay: {
    key: 'globoplay',
    label: 'Globoplay',
    prep: 'no',
    tmdbProviderId: 307,
    tmdbNetworkId: '3290', // rede Globoplay = originais
    originalsMinVotes: 0, // séries brasileiras têm poucos votos no TMDB
    cardShape: 'poster', // pôsteres verticais, como no app
    hasOfficialTop10: false,
    freshDays: { movie: 120, series: 90 },
    extraRows: [
      { id: 'novelas', type: 'series', name: 'Novelas', params: { with_genres: '10766' } },
      { id: 'tvglobo', type: 'series', name: 'Da TV Globo', params: { with_networks: '60' } },
      { id: 'globofilmes', type: 'movie', name: 'Cinema brasileiro da Globo Filmes', params: { with_companies: '13969' } },
    ],
    upcoming: { days: 180, networks: '3290|60', langs: ['pt', 'en', 'es'] },
  },
  crunchyroll: {
    key: 'crunchyroll',
    label: 'Crunchyroll',
    prep: 'na',
    tmdbProviderId: 283,
    tmdbNetworkId: '1112', // rede Crunchyroll = originais
    hasOfficialTop10: false,
    cardShape: 'poster', // anime em pôsteres verticais, como no app
    freshDays: { movie: 180, series: 30 },
    extraRows: [
      // Simulcasts: animes com episódio saindo agora (dos últimos 10 dias aos próximos 7).
      { id: 'simulcast', type: 'series', name: 'Simulcasts da temporada', params: () => ({ 'air_date.gte': dayISO(-10), 'air_date.lte': dayISO(7) }) },
      { id: 'anime-action', type: 'series', name: 'Ação e aventura', params: { with_genres: '10759' } },
      { id: 'anime-fantasy', type: 'series', name: 'Fantasia e ficção científica', params: { with_genres: '10765' } },
      { id: 'anime-comedy', type: 'series', name: 'Comédia', params: { with_genres: '35' } },
      { id: 'anime-drama', type: 'series', name: 'Drama', params: { with_genres: '18' } },
      { id: 'anime-mystery', type: 'series', name: 'Mistério e suspense', params: { with_genres: '9648' } },
    ],
    upcoming: { days: 120, networks: '1112' },
  },
  // "Todos os streamings": usado quando a opção "Mostrar conteúdo de todos os streamings" está ligada no plugin.
  // Sem filtro de streaming: busca, semelhantes, recomendações e fileiras trazem qualquer título do TMDB,
  // esteja ou não em algum serviço. As fileiras seguem a popularidade e têm limite (rowLimit) para não virarem
  // dezenas de milhares de títulos obscuros.
  all: {
    key: 'all',
    label: 'Todos os streamings',
    prep: 'em',
    tmdbProviderId: '*',
    rowLimit: 600,
    hasOfficialTop10: false,
    upcoming: { days: 120, networks: '213|2739|2552|1024|49|3186|6783|8304|3290',
      movieCompanies: '178464|145174|2|3|420|1|194232|20580|210099|174|9993', langs: ['en', 'pt', 'es', 'ko', 'ja'] },
  },
};

// Filtro de streaming do /discover do TMDB. tmdbProviderId '*' = sem filtro (qualquer título);
// aí só um piso de votos tira os cadastros vazios.
export const isAnyProvider = (provider) => provider.tmdbProviderId === '*';
export const watchFilter = (provider, { floor = true } = {}) => (isAnyProvider(provider)
  ? (floor ? { 'vote_count.gte': 10 } : {})
  : { with_watch_providers: provider.tmdbProviderId, with_watch_monetization_types: 'flatrate|ads' });

const dayISO = (offset) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

// Separador entre o nome do streaming e o nome da fileira.
// O plugin usa esse prefixo para reconhecer as fileiras de cada modo, então não mude
// um sem mudar o outro.
export const NAME_SEPARATOR = ' • ';
