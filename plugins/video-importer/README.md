# @zorritas/video-importer

Buscador e importador de videos para sitios Next.js + SQLite. Adapta los plugins
de WordPress (Ken Importer, WPS Mass Embedder, XVideos Importer Pro) al stack
actual del sitio (Next.js 16 + better-sqlite3 + App Router).

## Video Importer Studio

La forma recomendada de usarlo es mediante el panel local:

```bash
npm install
npm run studio
```

Después abre `http://127.0.0.1:4317`.

El Studio permite:

- Guardar perfiles para distintos sitios.
- Buscar videos desde el navegador.
- Editar títulos y descripciones antes de publicar.
- Importar una tabla CSV.
- Publicar en SQLite/Zorritas o WordPress REST.
- Exportar JSON para integrar un sitio futuro.

Los perfiles se guardan localmente en `video-importer.profiles.json`. Este
archivo puede contener credenciales y no debe subirse a Git.

### Adaptadores

- `zorritas-sqlite`: publica directamente en el esquema compatible con Zorritas.
- `wordpress-rest`: usa `/wp-json/wp/v2/posts` y una contraseña de aplicación.
- `json-export`: genera un archivo neutral que otro sitio puede consumir.

### Columnas CSV

```csv
source_id,video_id,source_url,title,description,category,tags,status
xvideos,123,https://www.xvideos.com/video.123/demo,Título,Descripción,categoria,"tag1,tag2",draft
```

También pueden incluirse `embed_url`, `thumbnail` y `duration` cuando el CSV
contenga videos que no fueron buscados previamente en el panel.

## Docker y Easypanel

El directorio incluye un `Dockerfile`. En Easypanel configura:

- Contexto o directorio de construcción: `plugins/video-importer`
- Puerto interno: `4317`
- Volumen persistente: `/data`
- Health check: `/health`

Variables recomendadas:

```env
VIDEO_IMPORTER_HOST=0.0.0.0
VIDEO_IMPORTER_PORT=4317
VIDEO_IMPORTER_PROFILES=/data/video-importer.profiles.json
VIDEO_IMPORTER_USER=admin
VIDEO_IMPORTER_PASSWORD=una-contraseña-larga
```

No expongas el Studio públicamente sin usuario y contraseña. Los perfiles
pueden contener credenciales de WordPress.

## Fuentes soportadas

- XVideos
- PornHub
- RedTube
- xHamster
- YouPorn

## Arquitectura

```
video-importer/
├── src/
│   ├── types.ts              Interfaces compartidas
│   ├── index.ts              Punto de entrada (exports públicos)
│   ├── publisher.ts          Inserción en SQLite (posts, post_metadata, embeds, terms...)
│   ├── cli.ts                CLI standalone (bun/tsx/deno)
│   ├── utils/
│   │   ├── fetcher.ts        HTTP fetch + helpers de parsing HTML
│   │   ├── slugify.ts        slugify, tags automáticos
│   │   └── duration.ts       Parseo y formato de duración
│   ├── sources/
│   │   ├── index.ts          Registro de fuentes
│   │   ├── base.ts           URL builders por fuente
│   │   ├── xvideos.ts        Scraper XVideos
│   │   ├── pornhub.ts        Scraper PornHub
│   │   ├── redtube.ts        Scraper RedTube
│   │   ├── xhamster.ts       Scraper xHamster
│   │   └── youporn.ts        Scraper YouPorn
│   └── admin/
│       ├── route.ts          Handler API para Next.js (App Router)
│       ├── VideoImporter.tsx  Componente React (client)
│       └── video-importer.css
├── package.json
└── tsconfig.json
```

## Integración en el webapp

### 1. Como dependencia local

En `zor3convertido/webapp/package.json`:

```json
{
  "dependencies": {
    "@zorritas/video-importer": "file:../../plugins/video-importer"
  }
}
```

Luego `npm install`.

### 2. API Route

Crea `app/api/admin/importer/route.ts`:

```ts
export { POST, GET, dynamic } from '@zorritas/video-importer/admin'
```

El proxy.ts ya protege `/api/admin/*` con Basic Auth — no hace falta auth extra.

### 3. Página admin

Crea `app/admin/importer/page.tsx`:

```tsx
import VideoImporter from '@zorritas/video-importer/admin/VideoImporter'
import '@zorritas/video-importer/admin/video-importer.css'

export const dynamic = 'force-dynamic'

export default function Page() {
  return <VideoImporter />
}
```

Y en `app/admin/layout.tsx` añade un link en el nav:

```tsx
<Link href="/admin/importer">Importar videos</Link>
```

### 4. Variables de entorno

El plugin usa las mismas variables que el webapp:

- `MIGRATION_DB_PATH` — ruta a `migration.db` (escritura para importar)
- `NEXT_PUBLIC_BASE_URL` — URL del sitio (para `guid` y enlaces)
- Opcional: `MAINTENANCE_ENABLED=1` si el admin se accede externamente

## Uso standalone (CLI)

```bash
# Buscar
npx tsx src/cli.ts search --source xvideos --keywords "mexicana"

# Buscar e importar
npx tsx src/cli.ts import \
  --source xvideos \
  --keywords "mexicana" \
  --db /data/migration.db \
  --status draft \
  --category amateur-mexicano \
  --thumb true \
  --limit 20
```

## Endpoints API

### `GET /api/admin/importer`

Devuelve la lista de fuentes disponibles.

### `POST /api/admin/importer?action=search`

Body: `{ sourceId, keywords, page?, minDuration? }`

Devuelve: `{ count, videos[] }`

### `POST /api/admin/importer?action=import`

Body: `{ videos[], options: { postStatus, categorySlug, downloadThumbnail } }`

Devuelve: `{ imported[], errors[] }`

No existe un límite fijo de resultados o videos por lote. La cantidad efectiva
depende de lo que entregue cada fuente y de los recursos disponibles.

## Esquema de DB

El publisher inserta en las mismas tablas que usa el webapp:

- `posts` — registro principal (post_type='post', post_status='publish'|'draft')
- `post_metadata` — claves `embed, link, duration, videoid, thumb` (usa `setMeta` que deduplica)
- `embeds` — registro del embed con `status='unchecked'` para que el audit lo revise
- `canonical_posts` — el post se marca como canónico
- `terms` / `term_taxonomy` / `term_relationships` — categoría y tags asignados
- `local_thumbnails` — si `downloadThumbnail: true`, se descarga y registra

Después de importar, ejecuta el botón "Auditar salud de videos" desde
`/admin` para que `video_health` y `canonical_term_counts` se actualicen.

## Diferencias con los plugins de WordPress originales

| WordPress | Este plugin |
|---|---|
| `wp_insert_post` | INSERT directo en `posts` |
| `post_meta` | `post_metadata` (mismas claves: embed, link, duration, videoid, thumb) |
| `wp_dropdown_categories` | Input de texto con slug de categoría |
| `simple_html_dom.php` | Parsing con `String.split` + regex (sin dependencias) |
| `wp_cron` | Sin cron (importación manual o vía CLI en cron del sistema) |
| `curl` + `cookies.txt` | `fetch()` nativo de Node 22 con UA aleatorio |
| JW Player / iframe custom | `<iframe>` sandbox (igual que `LazyVideoEmbed` del webapp) |
| Licencia WP-Script Core | Sin dependencias externas |

## Notas

- Los scrapers pueden romperse si las fuentes cambian su HTML. Si una fuente
  devuelve 0 resultados, revisa el HTML actual y ajusta los selectores en
  `src/sources/<fuente>.ts`.
- La importación es transaccional por video (si falla un video, los demás
  sí se importan).
- Los duplicados se detectan por `videoid` en `post_metadata`.
- Las miniaturas se descargan async al directorio `public/media/thumbs/`.
