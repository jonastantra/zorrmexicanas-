import { queryAll, queryOne } from '@/lib/sqlite'
import MaintenanceButtons from './MaintenanceButtons'

export const dynamic = 'force-dynamic'

export default function AdminPage() {
  const totals = queryOne<any>(`
    SELECT COUNT(*) total,
      SUM(video_status='ok') ok,
      SUM(video_status='dead') dead,
      SUM(video_status='unknown') unknown_count,
      SUM(thumbnail_status='real') real_thumbs,
      SUM(thumbnail_status='placeholder') placeholders
    FROM video_health
  `) || {}
  const recent = queryAll<any>(`
    SELECT post_id, slug, title, video_status, thumbnail_status, checked_at
    FROM video_health
    WHERE video_status='dead'
    ORDER BY checked_at DESC, post_id DESC
    LIMIT 20
  `)
  const cards = [
    ['Entradas', totals.total],
    ['Videos activos', totals.ok],
    ['Videos muertos', totals.dead],
    ['Por revisar', totals.unknown_count],
    ['Miniaturas reales', totals.real_thumbs],
    ['Placeholders', totals.placeholders],
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1>Mantenimiento de videos</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        {cards.map(([label, value]) => (
          <div key={String(label)} style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 10, padding: 16 }}>
            <div style={{ color: '#aaa', fontSize: 13 }}>{label}</div>
            <strong style={{ fontSize: 25 }}>{Number(value || 0).toLocaleString('es-MX')}</strong>
          </div>
        ))}
      </div>
      <MaintenanceButtons />
      <h2 style={{ marginTop: 28 }}>Videos muertos recientes</h2>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th>ID</th><th>Título</th><th>Video</th><th>Miniatura</th></tr></thead>
          <tbody>
            {recent.map((row) => (
              <tr key={row.post_id} style={{ borderTop: '1px solid #333' }}>
                <td style={{ padding: 8 }}>{row.post_id}</td>
                <td style={{ padding: 8 }}><a href={`/${row.slug}`} style={{ color: '#ff91ad' }}>{row.title}</a></td>
                <td style={{ padding: 8 }}>{row.video_status}</td>
                <td style={{ padding: 8 }}>{row.thumbnail_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
