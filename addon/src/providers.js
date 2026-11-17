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
};

// Separador entre o nome do streaming e o nome da fileira.
// O plugin usa esse prefixo para reconhecer as fileiras de cada modo, então não mude
// um sem mudar o outro.
export const NAME_SEPARATOR = ' • ';
