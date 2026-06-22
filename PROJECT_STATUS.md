# Estado del proyecto

**Fase:** consolidada — redirects emitidos, attachments consolidados, embeds muertos marcados, webapp filtrando duplicados, compilación Next.js verificada con éxito, lista para producción.
**Fecha:** 2026-06-22

---

## Resumen ejecutivo

La migración del sitio WordPress **zorritasmexicanas.com** a un stack moderno
(Next.js 16 + TypeScript + SQLite + Tailwind) está **lista para producción**.
Los 22,021 posts canónicos están servidos por el dev server en `http://localhost:3000`
con URLs idénticas al WP original, redirects 301 hacia los canónicos, miniaturas,
embeds validados y sitemap filtrado. Se ha verificado la compilación optimizada de Next.js
en su totalidad tras resolver las dependencias de tipos de `better-sqlite3`.

---

## Avance de hoy (2026-06-22)

### Compilación y Tipos TypeScript en `webapp/`
- Instalado `@types/better-sqlite3` para corregir la verificación de tipos de TypeScript.
- Ejecutado `npm run build` con éxito, generando todas las rutas dinámicas y estáticas correctamente en modo Turbopack.
- Validado el correcto funcionamiento del middleware y la carga del bundle de redirecciones.


- `lib/posts.ts` — añadido JOIN con tabla `canonical_posts` (22,021 IDs visibles) y
  filtro `NOT EXISTS (dead embed)`. Aplicado a `listPosts`, `listTrending`,
  `listPopular`, `listLatest`, `listRelated`, `getStats`.
- `app/[slug]/page.tsx` — si la URL es de un duplicado, redirige al canónico vía
  `getCanonicalForSlug` + `redirect()`.
- `app/sitemap.xml/route.ts` — el sitemap solo incluye posts canónicos con embed vivo.
  Antes 7.3 MB → ahora 5.3 MB.
- `middleware.ts` — carga `redirects.data.json` en el bundle y emite 301 antes del routing.
  Anteriormente solo manejaba date-prefixed URLs.

### Nueva tabla `canonical_posts` en `migration.db`

- 22,021 post_ids visibles.
- Construida con `_build_unique_canonical_set` (mismo algoritmo que los redirects).
- Usada como filtro principal en listados y sitemap.

### Índices añadidos

- `idx_pdg_post_canonical (post_id, is_canonical)` — acelera filtros sobre `post_duplicate_groups`.
- `idx_embeds_post_status (post_id, status)` — acelera filtros sobre `embeds`.
- `idx_post_media_media (media_id)` — acelera consolidación de attachments.
- `idx_thumb_candidates_media (media_id)` — idem para thumbnails.

---

## Datos migrados confirmados (fuente única = dump WP)

- `migration.db` (SQLite, 1.04 GB):
  - `posts`: 514,186 filas (283,146 publicados, 231,013 attachments)
  - `post_metadata`: 2,785,708 filas con Rank Math, embed, thumb, duration, videoid, etc.
  - `term_relationships`: 2,812,102 (33 categorías activas, 25,906 tags)
  - `post_duplicate_groups`: 1,066,619 (4 firmas: videoid, embed_url, thumb_url, title_norm)
  - `thumbnail_candidates`: 230,355 (todas `approved=1`, ahora apuntando al attachment canónico)
  - `post_media`: 230,355 (`relationship_type='thumbnail'`, FK remapeada)
  - `embeds`: 14,846 (14,751 OK + 95 dead)
  - `embed_checks`: 14,846
  - `redirects`: 6,262
  - `media_canonical_map`: 9,717 (remapeo de attachments)
  - `canonical_posts`: 22,021 (visibles)

---

## Estado del sitio nuevo

- Next.js 16.2.9 + React 19 + TypeScript + Tailwind.
- `next.config.ts` con `remotePatterns` para 9 hosts CDN/imágenes.
- `redirects.data.json` con 6,262 redirects servidos por middleware.
- Lee directo de `migration.db` vía `lib/posts.ts` (better-sqlite3).

### Smoke test (post-deploy local)

| URL                                                              | Status | Bytes  |
|------------------------------------------------------------------|--------|--------|
| `/`                                                              | 200    | 143 KB |
| `/categoria/porno-mexicano`                                      | 200    | 94 KB  |
| `/etiqueta/amateur`                                              | 200    | 96 KB  |
| `/page/2`                                                        | 200    | —      |
| `/sitemap.xml`                                                   | 200    | 5.3 MB |
| `/robots.txt`                                                    | 200    | —      |
| `/young-small-mexican-big-dick` (canónico)                       | 200    | 65 KB  |
| `/young-small-mexican-big-dick-2` (duplicado)                    | 301    | —      |

---

## Pendientes para producción

1. **Verificar dominio final** — `lib/site.ts` usa placeholder `zorritasmexicanas.com`.
   Confirmar antes de DNS cut.
2. **Subir sitemap al Search Console** — tras deploy.
3. **Re-validar embeds mensualmente** — comando disponible.
4. **Considerar S3/R2** si los CDNs externos (xvideos-cdn, phncdn, etc.) caen.
5. **Resolver 1 post faltante** entre dump y BD (514,187 vs 514,186).

---

## Riesgos abiertos (no bloqueantes)

- `uploads.tar.gz` perdido parcialmente; estrategia de fallback es CDN + dedup por hash.
- Conteos SQL se basan en parseo incremental; validados contra el dump original por muestreo.
- Sesiones se rompen a menudo; **HANDOFF.md** actualizado.

---

## Archivos de referencia

| Documento                                       | Propósito                                  |
|-------------------------------------------------|--------------------------------------------|
| `PROJECT_STATUS.md`                             | Estado ejecutivo (este archivo)             |
| `HANDOFF.md`                                    | Continuidad entre sesiones / agentes        |
| `DECISIONS.md`                                  | Decisiones técnicas (D-001 … D-008)         |
| `MIGRATION_PLAN.md`                             | Plan maestro de migración                  |
| `RUNBOOK.md`                                    | Comandos CLI                               |
| `DEPLOYMENT_PLAN.md`                            | Pasos para llevar a producción             |
| `DATA_VALIDATION_REPORT.md`                     | Validación cuantitativa                    |
| `MEDIA_DEDUPLICATION_REPORT.md`                 | Deduplicación de medios                    |
| `EMBED_VALIDATION_REPORT.md`                    | Validación de embeds                       |
| `SEO_MIGRATION_REPORT.md`                       | Estrategia SEO y metadata                  |
