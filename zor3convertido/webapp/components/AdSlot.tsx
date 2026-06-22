import { getAdSlot } from '@/lib/runtime-db'

export default function AdSlot({ slot }: { slot: string }) {
  const ad = getAdSlot(slot)
  if (!ad?.enabled || !ad.html.trim()) return null
  return (
    <aside className={`ad-slot ad-slot-${slot}`} aria-label={ad.label}>
      <span className="ad-label">Publicidad</span>
      <div dangerouslySetInnerHTML={{ __html: ad.html }} />
    </aside>
  )
}
