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
    tmdbProviderId: 350,
    tmdbNetworkId: 2552, // rede "Apple TV" = séries originais
    hasOfficialTop10: false,
    cardShape: 'poster', // no app (tvOS 26) as fileiras usam pôsteres na vertical
    freshDays: { movie: 240, series: 180 }, // lança pouco: janela maior em "Lançamentos"
    // Filmes originais = Apple Studios. Na Apple, até os que passaram nos cinemas (F1, Napoleão) são originais.
    originalMovies: { companies: '194232', since: '2019-11-01', allowTheatrical: true },
    upcoming: { days: 180, networks: '2552', movieCompanies: '194232' },
  },
};

// Separador entre o nome do streaming e o nome da fileira.
// O plugin usa esse prefixo para reconhecer as fileiras de cada modo, então não mude
// um sem mudar o outro.
export const NAME_SEPARATOR = ' • ';
