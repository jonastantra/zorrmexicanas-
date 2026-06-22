import Link from 'next/link'
import PostCard from '@/components/PostCard'
import { listPosts } from '@/lib/posts'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Buscar videos',
  robots: { index: false, follow: true },
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q || '').trim()

  return (
    <div className="search-page">
      <h1 className="page-title">Buscar videos</h1>

      <form action="/buscar" method="get">
        <input
          type="text"
          name="q"
          placeholder="Buscar por título..."
          defaultValue={query}
          autoFocus
        />
        <button type="submit">Buscar</button>
      </form>

      {query ? (
        <SearchResults query={query} />
      ) : (
        <div className="empty">
          <p>Ingresá un término de búsqueda para empezar.</p>
        </div>
      )}
    </div>
  )
}

function SearchResults({ query }: { query: string }) {
  const { posts, total } = listPosts({ search: query, perPage: 60 })
  return (
    <div>
      <p className="page-subtitle">{total.toLocaleString()} resultados para "{query}"</p>
      {posts.length > 0 ? (
        <div className="post-grid">
          {posts.map(p => <PostCard key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="empty">
          <h2>No se encontraron videos</h2>
          <p>Probá con otros términos. <Link href="/">Volver al inicio</Link></p>
        </div>
      )}
    </div>
  )
}