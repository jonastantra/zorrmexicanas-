import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostById } from '@/lib/posts'
import VideoEditor from './VideoEditor'

export const dynamic = 'force-dynamic'

export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const post = getPostById(Number((await params).id))
  if (!post) notFound()
  return <div style={{ maxWidth: 960, margin: '0 auto' }}>
    <div className="admin-page-head"><div><h1>Editar video #{post.id}</h1><p>{post.title}</p></div><Link href="/admin/videos">← Videos</Link></div>
    <VideoEditor video={post} />
  </div>
}
