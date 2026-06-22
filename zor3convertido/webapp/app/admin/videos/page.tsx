import Link from 'next/link'
import { queryAll } from '@/lib/sqlite'

export const dynamic = 'force-dynamic'

export default async function VideosAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() || ''
  const rows = queryAll<any>(`
    SELECT p.id,p.post_name slug,p.post_title title,p.post_status status,
      (SELECT video_status FROM video_health WHERE post_id=p.id) health
    FROM canonical_posts cp JOIN posts p ON p.id=cp.post_id
    WHERE p.post_type='post' AND (?='' OR p.post_title LIKE ? OR p.post_name LIKE ? OR CAST(p.id AS TEXT)=?)
    ORDER BY p.post_modified DESC,p.id DESC LIMIT 100
  `, [q, `%${q}%`, `%${q}%`, q])
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1>Videos</h1>
      <form className="admin-search"><input name="q" defaultValue={q} placeholder="Título, slug o ID" /><button>Buscar</button></form>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>ID</th><th>Título</th><th>Estado</th><th /></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{row.id}</td><td><Link href={`/${row.slug}`}>{row.title}</Link><small>/{row.slug}</small></td>
          <td>{row.health || row.status}</td><td><Link className="admin-edit" href={`/admin/videos/${row.id}`}>Editar</Link></td>
        </tr>)}</tbody>
      </table></div>
    </div>
  )
}
