import Link from 'next/link'
import { getRuntimeDb } from '@/lib/runtime-db'
import SettingsForm from './SettingsForm'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const ads = getRuntimeDb().prepare(`
    SELECT slot_key,label,html,enabled FROM ad_slots ORDER BY rowid
  `).all() as any[]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="admin-page-head">
        <div>
          <h1>Publicidad y plantilla</h1>
          <p>Zonas inspiradas en KingTube, separadas de los datos del catálogo.</p>
        </div>
        <Link href="/admin">← Panel</Link>
      </div>
      <SettingsForm ads={ads} />
    </div>
  )
}
