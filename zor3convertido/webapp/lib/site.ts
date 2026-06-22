export const SITE_CONFIG = {
  name: 'Zorritas Mexicanas',
  shortName: 'ZorritasMexicanas',
  tagline: 'Porno Mexicano, Amateur y Más',
  description: 'Videos porno gratis de mexicanas, amateur mexicano, latinas y más. Miles de videos actualizados diariamente.',
  baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  // For redirect generation - old WP URL format was /YYYY/MM/slug
  postsPerPage: 24,
  // Categories displayed on home (top traffic)
  featuredCategorySlugs: ['amateur-mexicano', 'porno-mexicano', 'mexicanas', 'morritas-xxx'],
}

export const CATEGORY_SEO_COPY: Record<string, { title: string; description: string }> = {
  'amateur-casero': {
    title: 'Videos amateur y caseros',
    description: 'Explora videos amateur y caseros organizados en una colección actualizada, con duración y contenidos relacionados.',
  },
  'porno-mexicano': {
    title: 'Porno mexicano',
    description: 'Colección de videos mexicanos organizada por popularidad y fecha, con páginas individuales y reproducción integrada.',
  },
  mexicanas: {
    title: 'Videos de mexicanas',
    description: 'Videos de mexicanas y contenido amateur relacionado, clasificado para facilitar el descubrimiento de nuevas publicaciones.',
  },
  colegialas: {
    title: 'Videos de colegialas',
    description: 'Colección temática para adultos organizada con etiquetas, duración, popularidad y contenidos relacionados.',
  },
}

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
