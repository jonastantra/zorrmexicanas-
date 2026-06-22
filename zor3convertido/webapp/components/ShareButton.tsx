'use client'

import { useState } from 'react'

export default function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, url })
        return
      } catch { /* fallthrough to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <button type="button" className="action-btn" onClick={share}>
      {copied ? '✓ Copiado' : '🔗 Compartir'}
    </button>
  )
}
