import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Admin Panel',
  robots: 'noindex, nofollow',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ margin: '-24px', padding: 0, background: '#0d0d13', color: '#fff', minHeight: '100vh' }}>
        <nav style={{
          background: '#1a1a2e',
          borderBottom: '1px solid #333',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <span style={{ color: '#ff2e63', fontWeight: 'bold', fontSize: '18px' }}>
            Admin
          </span>
          <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
            <Link href="/" style={{ color: '#ccc', textDecoration: 'none' }}>Ver Sitio</Link>
            <Link href="/admin" style={{ color: '#ccc', textDecoration: 'none' }}>Resumen</Link>
            <Link href="/admin/settings" style={{ color: '#ccc', textDecoration: 'none' }}>Publicidad</Link>
            <Link href="/admin/blocks" style={{ color: '#ccc', textDecoration: 'none' }}>Portada</Link>
            <Link href="/admin/videos" style={{ color: '#ccc', textDecoration: 'none' }}>Videos</Link>
            <Link href="/admin/importer" style={{ color: '#ccc', textDecoration: 'none' }}>Importar</Link>
          </div>
        </nav>
        <main style={{ padding: '20px' }}>
          {children}
        </main>
    </section>
  )
}
