export const SITE_CONFIG = {
  name: 'Mi sitio de videos',
  shortName: 'MiSitio',
  tagline: 'Videos actualizados',
  description: 'Descripción única del sitio para buscadores.',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  locale: 'es-MX',
  postsPerPage: 24,
  featuredCategorySlugs: [],
  theme: {
    accent: '#ff2e63',
    background: '#09090b',
    surface: '#15151d',
  },
}
