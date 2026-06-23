export function slugify(text: string): string {
  const map: Record<string, string> = {
    'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
    'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
    'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
    'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
    'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
    'ñ': 'n', 'ç': 'c', 'ý': 'y', 'ÿ': 'y',
  }
  let out = text.toLowerCase()
  out = out.replace(/[áàäâãåéèëêíìïîóòöôõúùüûñçýÿ]/g, (c) => map[c] ?? c)
  out = out.replace(/[^a-z0-9\s-]/g, '')
  out = out.replace(/\s+/g, '-')
  out = out.replace(/-+/g, '-')
  out = out.replace(/^-|-$/g, '')
  return out.slice(0, 200)
}

export function uniqueSlug(base: string, exists: (s: string) => boolean): string {
  let slug = base
  let n = 2
  while (exists(slug)) {
    slug = `${base}-${n}`
    n++
  }
  return slug
}

export function titleToTags(title: string, max = 12): string[] {
  const stopwords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'u',
    'en', 'con', 'por', 'para', 'que', 'su', 'sus', 'se', 'le', 'les', 'lo', 'a', 'e', 'i',
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'her', 'his', 'she', 'him', 'get',
    'has', 'had', 'was', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'one', 'our', 'out',
    'like', 'gets', 'got', 'hot', 'cum', 'big', 'milf', 'teen', 'amateur', 'anal', 'sexy',
    'girl', 'girls', 'boy', 'boys', 'fuck', 'fucks', 'fucked', 'fucking',
  ])
  const words = title.toLowerCase()
    .replace(/[^a-záéíóúñü\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length >= 3 && w.length <= 22 && !stopwords.has(w) && !/^\d+$/.test(w))
  const seen = new Set<string>()
  const tags: string[] = []
  for (const w of words) {
    const t = slugify(w)
    if (t && !seen.has(t)) {
      seen.add(t)
      tags.push(t)
      if (tags.length >= max) break
    }
  }
  return tags
}
