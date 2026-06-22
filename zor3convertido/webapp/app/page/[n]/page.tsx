import Link from 'next/link'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import { listPosts } from '@/lib/posts'
import { SITE_CONFIG } from '@/lib/site'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Página {n} - Videos Porno',
}

export default async function PaginatedHome({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params
  const page = parseInt(n, 10) || 1
  if (page < 2) {
    return (
      <div className="empty">
        <h2>Página inválida</h2>
        <p>Las páginas empiezan en 1. <Link href="/">Volver al inicio</Link></p>
      </div>
    )
  }
  const { posts, pages } = listPosts({ page, perPage: SITE_CONFIG.postsPerPage })
  if (!posts.length) {
    return (
      <div className="empty">
        <h2>No hay videos en esta página</h2>
        <p><Link href="/">Volver al inicio</Link></p>
      </div>
    )
  }
  return (
    <div>
      <h1 className="page-title">Página {page}</h1>
      <p className="page-subtitle">Videos más recientes</p>
      <div className="post-grid">
        {posts.map(p => <PostCard key={p.id} post={p} />)}
      </div>
      <Pagination page={page} pages={pages} basePath="/" />
    </div>
  )
}