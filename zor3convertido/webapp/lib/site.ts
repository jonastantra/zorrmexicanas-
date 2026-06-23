export const SITE_CONFIG = {
  name: 'Zorritas Mexicanas',
  shortName: 'ZorritasMexicanas',
  tagline: 'Porno mexicano casero, amateur y videos latinos',
  description: 'Página de porno mexicano casero, videos amateur de mexicanas y contenido latino organizado por categorías, etiquetas, duración y tendencias.',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  // For redirect generation - old WP URL format was /YYYY/MM/slug
  postsPerPage: 24,
  // Categories displayed on home (top traffic)
  featuredCategorySlugs: ['amateur-mexicano', 'porno-mexicano', 'mexicanas', 'morritas-xxx'],
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
