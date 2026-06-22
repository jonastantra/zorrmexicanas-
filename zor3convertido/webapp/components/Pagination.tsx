import Link from 'next/link'

export default function Pagination({ page, pages, basePath }: { page: number; pages: number; basePath: string }) {
  if (pages <= 1) return null

  const buildHref = (p: number) => {
    if (p === 1) return basePath
    return `${basePath}page/${p}`
  }

  const items: (number | 'gap')[] = []
  const push = (n: number | 'gap') => items.push(n)

  // Always show: 1, current-1, current, current+1, last
  push(1)
  if (page > 3) push('gap')
  for (let p = Math.max(2, page - 1); p <= Math.min(pages - 1, page + 1); p++) {
    push(p)
  }
  if (page < pages - 2) push('gap')
  if (pages > 1) push(pages)

  return (
    <nav className="pagination" aria-label="Paginación">
      {page > 1 ? (
        <Link href={buildHref(page - 1)}>‹ Anterior</Link>
      ) : (
        <span className="disabled">‹ Anterior</span>
      )}
      {items.map((it, idx) =>
        it === 'gap' ? (
          <span key={`g${idx}`} className="disabled">…</span>
        ) : it === page ? (
          <span key={it} className="current">{it}</span>
        ) : (
          <Link key={it} href={buildHref(it)}>{it}</Link>
        )
      )}
      {page < pages ? (
        <Link href={buildHref(page + 1)}>Siguiente ›</Link>
      ) : (
        <span className="disabled">Siguiente ›</span>
      )}
    </nav>
  )
}