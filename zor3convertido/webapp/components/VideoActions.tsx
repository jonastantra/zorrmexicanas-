'use client'

import { useEffect, useState } from 'react'

type Metrics = { views: number; likes: number; dislikes: number; shares: number }

export default function VideoActions({
  postId,
  title,
  initial,
}: {
  postId: number
  title: string
  initial: Metrics
}) {
  const [metrics, setMetrics] = useState(initial)
  const [voted, setVoted] = useState('')

  useEffect(() => {
    const recordView = () => {
      fetch(`/api/posts/${postId}/metrics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'view' }),
      }).then(r => r.json()).then(setMetrics).catch(() => {})
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(recordView, { timeout: 3000 })
      return () => idleWindow.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(recordView, 1500)
    return () => window.clearTimeout(id)
  }, [postId])

  async function act(action: 'like' | 'dislike' | 'share') {
    if ((action === 'like' || action === 'dislike') && voted) return
    if (action === 'share') {
      const url = window.location.href
      if (navigator.share) await navigator.share({ title, url }).catch(() => {})
      else await navigator.clipboard.writeText(url).catch(() => {})
    }
    const response = await fetch(`/api/posts/${postId}/metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (response.ok) setMetrics(await response.json())
    if (action === 'like' || action === 'dislike') setVoted(action)
  }

  return (
    <div className="video-actions" aria-label="Acciones del video">
      <span className="video-views">👁 {metrics.views.toLocaleString('es-MX')} vistas</span>
      <button className={voted === 'like' ? 'active' : ''} onClick={() => act('like')}>👍 {metrics.likes}</button>
      <button className={voted === 'dislike' ? 'active' : ''} onClick={() => act('dislike')}>👎 {metrics.dislikes}</button>
      <button onClick={() => act('share')}>↗ Compartir</button>
    </div>
  )
}
