import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div className="empty" style={{ padding: '120px 20px' }}>
      <div style={{
        fontSize: 96,
        fontWeight: 900,
        background: 'var(--accent-gradient)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-4px',
        lineHeight: 1,
        marginBottom: 12,
      }}>404</div>
      <h2>Esta página se nos escapó 🔥</h2>
      <p style={{ maxWidth: 480, margin: '0 auto 24px' }}>
        El video que buscás no existe, fue removido o la URL no es correcta.
        Probá con la búsqueda o volvé al inicio para descubrir otros videos.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/" className="action-btn primary">🏠 Ir al inicio</Link>
        <Link href="/buscar" className="action-btn">🔍 Buscar videos</Link>
      </div>
    </div>
  )
}
