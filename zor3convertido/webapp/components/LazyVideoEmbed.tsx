'use client'

import { useState } from 'react'

export default function LazyVideoEmbed({
  src,
  title,
  poster,
}: {
  src: string
  title: string
  poster: string | null
}) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <div className="video-frame">
        <iframe
          src={src}
          title={title}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      className="video-frame video-poster"
      onClick={() => setPlaying(true)}
      aria-label={`Reproducir ${title}`}
    >
      {poster ? (
        // The poster is served locally and is the intended LCP element.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          width="1280"
          height="720"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      ) : null}
      <span className="video-poster-shade" aria-hidden />
      <span className="video-poster-play" aria-hidden>▶</span>
      <span className="video-poster-label">Reproducir video</span>
    </button>
  )
}
