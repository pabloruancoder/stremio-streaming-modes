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
    // Marcas da tela inicial (filtros do TMDB dentro do catálogo da Disney+ Brasil).
    brands: [
      { id: 'disney', name: 'Disney', movie: { with_companies: '2|6125' }, series: { with_companies: '2|6125|3475|670' } },
      { id: 'pixar', name: 'Pixar', movie: { with_companies: '3' }, series: { with_companies: '3' } },
      { id: 'marvel', name: 'Marvel', movie: { with_companies: '420|7505' }, series: { with_companies: '420|7505|13252|38679' } },
      { id: 'starwars', name: 'Star Wars', movie: { with_companies: '1' }, series: { with_companies: '1' } },
      { id: 'natgeo', name: 'National Geographic', movie: { with_companies: '7521|114038' }, series: { with_networks: '43|1043|799' } },
      { id: 'star', name: 'Star', movie: { with_companies: '127928|25|43' }, series: { with_networks: '88|453|1035' } },
    ],
  },
};

// Separador entre o nome do streaming e o nome da fileira.
// O plugin usa esse prefixo para reconhecer as fileiras de cada modo, então não mude
// um sem mudar o outro.
export const NAME_SEPARATOR = ' • ';
