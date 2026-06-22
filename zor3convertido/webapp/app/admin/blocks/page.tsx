import { getRuntimeDb } from '@/lib/runtime-db'
import BlocksForm from './BlocksForm'

export const dynamic = 'force-dynamic'

export default function BlocksPage() {
  const blocks = getRuntimeDb().prepare(`
    SELECT block_key,title,block_type,item_limit,position,enabled
    FROM homepage_blocks ORDER BY position,rowid
  `).all() as any[]
  return <div style={{ maxWidth: 1000, margin: '0 auto' }}><h1>Bloques de portada</h1><p>Equivalente a los widgets de videos de KingTube.</p><BlocksForm initial={blocks} /></div>
}
