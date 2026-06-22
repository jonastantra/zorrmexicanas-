# SEO Migration Report — zorritasmexicanas.com

**Fecha:** 2026-06-21

---

## 1. Estrategia de preservación de SEO

El objetivo es **mantener el posicionamiento orgánico** del sitio WordPress original
migrando a un stack moderno (Next.js). Las decisiones clave son:

1. **URLs exactas** — los slugs del WP se conservan 1-a-1 en la BD nueva.
2. **Redirects 301** — para posts duplicados detectados, se emite un 301 hacia el canónico.
3. **Canonical en metadata** — cada página declara `alternates.canonical = /${slug}`.
4. **Open Graph y Twitter Cards** — se generan desde los meta de Rank Math + post_excerpt.
5. **Datos estructurados (JSON-LD VideoObject)** — solo cuando hay datos válidos confirmados.
6. **Sitemap** — incluye solo posts canónicos y vivos (no duplicados, no embeds muertos).
7. **robots.txt** — declara `Sitemap: https://zorritasmexicanas.com/sitemap.xml` y bloquea `/admin/`.

---

## 2. URLs conservadas

### Mapeo de estructura de permalinks

WordPress original usaba `post_name` (slug) directamente, ej:

```
https://zorritasmexicanas.com/young-small-mexican-big-dick/
```

La nueva estructura:

```
https://zorritasmexicanas.com/young-small-mexican-big-dick
```

(sin slash final; Next.js lo acepta automáticamente)

### Comprobación

- 100% de los posts canónicos conserva su slug original.
- 100% de las categorías conserva su slug (`amateur-mexicano`, `porno-mexicano`, …).
- 100% de las etiquetas conserva su slug (`amateur`, `anal`, …).

---

## 3. Redirects 301 (`generate-redirects`)

### Resultado

- **Redirects emitidos:** 6,262
- **Duplicados omitidos** (mismo slug que canónico): 0
- **Sin slug utilizable:** 254,935 (duplicados que ya no tenían URL pública)
- **Filtrados por ruido** (`%`-encoded, demasiado cortos, numéricos): 65
- **Auto-redirects omitidos** (mismo slug en source y target): 0

### Formato

Cada redirect en `migration.db.redirects`:

| Columna               | Tipo    | Descripción                                    |
|-----------------------|---------|------------------------------------------------|
| `source_url`          | TEXT    | `/slug-del-duplicado`                          |
| `target_url`          | TEXT    | `/slug-del-canonico`                           |
| `status_code`         | INTEGER | 301                                            |
| `reason`              | TEXT    | `post_duplicate` (+ `dead_embed` si aplica)    |
| `duplicate_post_id`   | INTEGER | ID original duplicado (auditoría)              |
| `canonical_post_id`   | INTEGER | ID canónico (auditoría)                        |
| `created_at`          | TEXT    | ISO 8601                                       |

### Aplicación

El middleware de Next.js (`zor3convertido/webapp/middleware.ts`) carga los redirects desde
`redirects.data.json` (788 KB, regenerable con `python -m src.cli export-redirects`)
y los aplica antes de cualquier handler.

### Distribución de destinos (top 5)

Los redirects apuntan mayormente a los slugs canónicos consolidados. El más común
es el sufijo `-2` → base: `slug-2`, `slug-3`, …, `slug-N`.

---

## 4. Metadatos SEO por página

### Homepage (`/`)

```html
<title>Zorritas Mexicanas — {tagline}</title>
<meta name="description" content="{tagline}" />
<link rel="canonical" href="https://zorritasmexicanas.com/" />
<meta property="og:title" content="{tagline}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://zorritasmexicanas.com/" />
```

### Página individual (`/[slug]`)

```html
<title>{post.title}</title>
<meta name="description" content="{post.excerpt || post.title}" />
<link rel="canonical" href="https://zorritasmexicanas.com/{post.slug}" />
<meta property="og:title" content="{post.title}" />
<meta property="og:description" content="{post.excerpt}" />
<meta property="og:image" content="{post.thumb}" />
<meta property="og:type" content="video.other" />
<meta name="robots" content="index, follow" />
```

### JSON-LD (VideoObject) — solo con datos confirmados

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "{post.title}",
  "description": "{post.excerpt || title}",
  "thumbnailUrl": "{post.thumb}" (si existe),
  "uploadDate": "{post.date}" (ISO 8601 desde post_date),
  "duration": "{post.duration}" (ISO 8601, solo si Rank Math lo pobló),
  "embedUrl": "{iframe_src}" (extraído del meta embed),
  "contentUrl": "{post.link}" (link original al proveedor, si existe),
  "url": "/{post.slug}"
}
```

**NO** se inventan: `duration`, `contentUrl`, `author`, ni estadísticas.

### Categoría (`/categoria/[slug]`)

```html
<title>{category.name} — Zorritas Mexicanas</title>
<meta name="description" content="{category.description || auto}" />
<link rel="canonical" href="https://zorritasmexicanas.com/categoria/{slug}" />
<meta name="robots" content="index, follow" />
```

### Etiqueta (`/etiqueta/[slug]`)

Similar a categoría. Si `count < 50` se aplica `noindex, follow`.

---

## 5. Sitemap (`/sitemap.xml`)

### Estructura

El sitemap es un **único archivo** con hasta 30,000 URLs (el set canónico). Si el sitio
crece más allá, se divide en chunks de 10,000 y se usa `sitemap-index.xml`.

### Contenido actual

- **URLs totales:** ~22,021 posts canónicos + 33 categorías + ~25,906 tags + 1 home
- **Tamaño:** ~5.3 MB
- **Cache-Control:** `public, max-age=3600`

### Política de inclusión

| Tipo                  | ¿Incluido? | Notas                                |
|-----------------------|-----------|--------------------------------------|
| Posts canónicos       | ✅        | Solo con embed vivo                  |
| Posts duplicados      | ❌        | Cubiertos por 301 a canónico         |
| Posts con embed muerto| ❌        | Se filtran en query                  |
| Categorías (count>0)  | ✅        | `priority=0.8, changefreq=daily`     |
| Tags (count≥50)       | ✅        | `priority=0.5, changefreq=weekly`    |
| Tags (count<50)       | ❌        | Evitar thin content                  |
| Home                  | ✅        | `priority=1.0, changefreq=hourly`    |

---

## 6. robots.txt (`/robots.txt`)

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://zorritasmexicanas.com/sitemap.xml
```

---

## 7. Paginación

Las páginas de listado (`/page/2`, `/page/3`, …) son accesibles y devuelven 200.
Cada página declara `canonical=/` (la home principal, no `/page/N`) para evitar
canibalización.

---

## 8. Open Graph y Twitter Cards

| Plataforma   | Configuración                                           |
|--------------|---------------------------------------------------------|
| Open Graph   | `og:title`, `og:description`, `og:image`, `og:type=video.other` |
| Twitter      | `twitter:card=summary_large_image` (si hay thumb)        |

Las imágenes OG vienen del `thumb` meta (CDN externo). Si el thumb está vacío, no se
emite la meta.

---

## 9. Datos estructurados — validación

Solo se emite JSON-LD VideoObject cuando:

- ✅ `post.title` no está vacío
- ✅ `post.excerpt || post.title` para `description`
- ✅ `post.date` es parseable como ISO 8601
- ✅ `post.thumb` existe → `thumbnailUrl`
- ⚠️ `duration` solo si Rank Math lo pobló (formato ISO 8601: `PT5M30S`)
- ⚠️ `embedUrl` solo si el meta `embed` parsea como iframe con `src`
- ⚠️ `contentUrl` solo si el meta `link` existe

**Nunca** se inventan: duración estimada, autor (a menos que provenga de Rank Math),
fecha de subida (se usa `post_date` original), ni likes/views (no están en la BD).

---

## 10. Acciones pendientes (pre-producción)

- [ ] Sustituir `https://zorritasmexicanas.com` en `lib/site.ts` por el dominio final verificado.
- [ ] Verificar que el CDN externo sigue activo (`xvideos-cdn.com`, `phncdn.com`, etc.).
- [ ] Confirmar con el propietario que las redirecciones masivas a `/b`, `/videoplayback` (65 filtradas)
      no son URLs indexadas legítimamente.
- [ ] Subir el sitemap.xml al Search Console para validación.
- [ ] Monitorear 404 en Search Console durante 2-4 semanas post-migración.

---

## 11. Riesgos SEO abiertos

1. **Cambio de hash en sitemap.xml** — al haber reorganizado canonical_posts, el sitemap cambia
   de 30k URLs de posts cualesquiera a solo canónicos. Google puede tardar en re-indexar.
2. **Reducción de URLs publicadas** — pasamos de 283k posts publicados a 22k canónicos.
   Si Google tenía indexados duplicados con tráfico, ese tráfico se redirige al canónico.
3. **Cambio de `theme`/`layout`** — Google puede notar cambios en estructura. Mitigado por
   conservar breadcrumbs y mantener los mismos `slug`, `title`, `description`.
4. **robots.txt cambia** — el WP original probablemente no bloqueaba `/admin/` de la misma manera.
   Asegurarse de que no haya páginas útiles ahí.
