// Identidad del sitio configurable por variables de entorno. Los valores por
// defecto son los de Zorritas Mexicanas (así el sitio actual no cambia). Para
// un sitio nuevo (LobasMexicanas) basta con definir las NEXT_PUBLIC_* en
// EasyPanel — el MISMO código sirve ambos sitios.
const env = (k: string, fallback: string) => process.env[k] || fallback

export const SITE_CONFIG = {
  name: env('NEXT_PUBLIC_SITE_NAME', 'Zorritas Mexicanas'),
  shortName: env('NEXT_PUBLIC_SITE_SHORTNAME', 'ZorritasMexicanas'),
  tagline: env('NEXT_PUBLIC_SITE_TAGLINE', 'Porno mexicano casero, amateur y videos latinos'),
  description: env(
    'NEXT_PUBLIC_SITE_DESCRIPTION',
    'Página de porno mexicano casero, videos amateur de mexicanas y contenido latino organizado por categorías, etiquetas, duración y tendencias.'
  ),
  baseUrl: env('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000'),
  // Iniciales del logo (ej. "Zorritas Mexicanas" -> "ZM"). Override opcional.
  mark: env(
    'NEXT_PUBLIC_SITE_MARK',
    env('NEXT_PUBLIC_SITE_NAME', 'Zorritas Mexicanas')
      .split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase()
  ),
  // For redirect generation - old WP URL format was /YYYY/MM/slug
  postsPerPage: 24,
  // Categories displayed on home (top traffic)
  featuredCategorySlugs: ['amateur-mexicano', 'porno-mexicano', 'mexicanas', 'morritas-xxx'],
}

// Temas de color. El tema se elige con NEXT_PUBLIC_THEME (default 'rose' = el
// actual de Zorritas). 'blue' = azul eléctrico para LobasMexicanas. Las
// variables se inyectan en <head> sobre las de globals.css.
export const THEMES: Record<string, Record<string, string>> = {
  rose: {
    '--accent': '#ff2e63',
    '--accent-hover': '#ff5e8a',
    '--accent-soft': 'rgba(255, 46, 99, 0.16)',
    // Gradiente de 3 paradas, más vibrante (rosa → coral → ámbar).
    '--accent-gradient': 'linear-gradient(135deg, #ff2e63 0%, #ff4d5e 45%, #ff8a3d 100%)',
    '--accent-gradient-hover': 'linear-gradient(135deg, #ff5e8a 0%, #ff6e6e 45%, #ffa45e 100%)',
    '--accent-glow': '0 8px 30px rgba(255, 46, 99, 0.35)',
  },
  blue: {
    '--accent': '#2f6bff',
    '--accent-hover': '#5b8bff',
    '--accent-soft': 'rgba(47, 107, 255, 0.18)',
    // Azul eléctrico → cian.
    '--accent-gradient': 'linear-gradient(135deg, #2f6bff 0%, #00b4ff 50%, #21e0fd 100%)',
    '--accent-gradient-hover': 'linear-gradient(135deg, #5b8bff 0%, #3fcaff 50%, #5beaff 100%)',
    '--accent-glow': '0 8px 30px rgba(47, 107, 255, 0.38)',
  },
}

export const ACTIVE_THEME = THEMES[env('NEXT_PUBLIC_THEME', 'rose')] || THEMES.rose

/** CSS para inyectar el tema activo en <head> (sobrescribe globals.css). */
export function themeCss(): string {
  const vars = Object.entries(ACTIVE_THEME).map(([k, v]) => `${k}:${v}`).join(';')
  return `:root{${vars}}`
}

export const CATEGORY_SEO_COPY: Record<string, { title: string; description: string }> = {
  'amateur-casero': {
    title: 'Porno casero mexicano y videos amateur',
    description: 'Colección de porno casero mexicano, videos amateur y escenas latinas organizadas por fecha, duración, etiquetas y contenidos relacionados.',
  },
  'porno-mexicano': {
    title: 'Porno mexicano',
    description: 'Página de porno mexicano con videos caseros, amateur y latinos organizados por popularidad, fecha, categorías y reproducción integrada.',
  },
  mexicanas: {
    title: 'Videos de mexicanas',
    description: 'Videos de mexicanas, zorras mexicanas y contenido amateur relacionado, clasificado para facilitar el descubrimiento de nuevas publicaciones.',
  },
  colegialas: {
    title: 'Videos de colegialas',
    description: 'Colección temática para adultos organizada con etiquetas, duración, popularidad y contenidos relacionados.',
  },
}

export const SEARCH_CONSOLE_TOPICS = [
  { label: 'porno casero mexicano', href: '/categoria/amateur-casero' },
  { label: 'porno mexicano', href: '/categoria/porno-mexicano' },
  { label: 'página porno mexicano', href: '/categoria/porno-mexicano' },
  { label: 'zorras mexicanas', href: '/categoria/mexicanas' },
  { label: 'videos de mexicanas', href: '/categoria/mexicanas' },
  { label: 'cuckold real', href: '/buscar?q=cuckold+real' },
]

export type PostListItem = {
  id: number
  slug: string
  title: string
  excerpt: string
  date: string
  thumb: string | null
  duration: string | null
  views: number
  categories: { slug: string; name: string }[]
}

export type Post = PostListItem & {
  content: string
  embed: string | null
  link: string | null
  videoId: string | null
  tags: { slug: string; name: string }[]
}
