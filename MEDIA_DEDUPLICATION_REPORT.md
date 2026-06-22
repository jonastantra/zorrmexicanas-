# Media Deduplication Report — zorritasmexicanas.com

**Fecha:** 2026-06-21

---

## 1. Inventario de medios

- **Attachments totales en WP:** 231,013
- **Posts con `_thumbnail_id`:** 230,355
- **Attachments referenciados por posts:** 230,355 (100% integridad)
- **Attachments huérfanos (sin post):** 658 (posts attachment sin post_parent o sin uso)

---

## 2. Detección de duplicados (`repair-thumbnails`)

### Estrategia

WordPress nombra los archivos subidos con un hash MD5 del contenido + extensión.
Ejemplo: `50db05a015d92d7fcf43c657f6cfbe24.9.jpg` → el prefijo hex de 32 caracteres
es el hash del archivo original.

### Algoritmo

1. Escanear todos los attachments y extraer el hash inicial del `_wp_attached_file`.
2. Agrupar attachments con el mismo hash.
3. Marcar todos los miembros de cada grupo (excepto el primero, canónico por `min(id)`).

### Resultado

| Métrica                                | Valor   |
|----------------------------------------|---------|
| Clusters con attachments duplicados    | 1,761   |
| Attachments duplicados (total)         | 9,717   |
| Cluster más grande (count)             | 57      |
| Posts apuntando a attachments dupes    | 7,855   |

### Cluster destacado

| Hash prefix                            | Count | Causa probable                                |
|----------------------------------------|-------|------------------------------------------------|
| `1e5f0c8...` (La más zorra)            | 57    | Auto-posteo cada hora del mismo thumbnail     |
| Otros 1,760 clusters                   | 9,660 | Re-importación, scripts de scraping, o réplicas|

---

## 3. Consolidación (`consolidate-duplicate-attachments`)

### Acciones

- `media_canonical_map` poblada: **9,717** filas `dup → canonical`.
- `post_media.media_id` actualizado para apuntar al canónico (solo cambia la FK, **no se borra ningún archivo**).
- `thumbnail_candidates.media_id` actualizado: las nuevas asociaciones sirven para joins futuros.

### Ahorro estimado

- Si se decidiera **eliminar físicamente** los attachments duplicados: 9,717 archivos.
- Tamaño promedio attachment: ~150 KB (estimación con `xe Thumb`-size 220×120).
- **Ahorro potencial:** ~1.4 GB en disco (no ejecutado; los originales se preservan por seguridad).
- En el modelo nuevo (que solo referencia el canónico vía FK), el ahorro es **lógico**: 9,717 attachments
  no aparecen nunca al usuario, aunque sigan ocupando espacio.

### Estrategia de hosting recomendada (no aplicada aún)

1. **Verificar CDN externo** (`*.xvideos-cdn.com`, `*.phncdn.com`, `*.rdtcdn.com`, `*.ypncdn.com`)
   sigue sirviendo las imágenes. Los CDNs ya están whitelisteados en `next.config.ts`.
2. Si el CDN cae, descargar los attachments canónicos al storage local (LocalMediaStorage).
3. Subir a S3/R2 cuando esté listo para producción.

---

## 4. Reportes CSV generados

| Archivo                                                  | Filas | Tamaño |
|----------------------------------------------------------|-------|--------|
| `_migration_workspace/reports/attachment-duplicates.csv` | 1,761 | 246 KB |
| `_migration_workspace/reports/thumbnail-mapping.csv`     | 230,355 | 21 MB |
| `_migration_workspace/reports/canonical-media-map.csv`    | 9,717 | 250 KB |
| `_migration_workspace/reports/thumbnail-orphans.csv`     | (generado bajo demanda) | — |

---

## 5. Acciones NO realizadas (decisión consciente)

- ❌ Eliminar attachments duplicados físicamente (riesgo de romper URLs externas referenciadas).
- ❌ Cambiar el formato de las imágenes (no medido ahorro real vs pérdida de calidad).
- ❌ Subir a S3/R2 (pendiente de credenciales del propietario).

Los originales están preservados en `kingtube.tar.gz` y en el dump `gxvcqtpl_zorritasmexicanaclon.sql`
(como `wp_posts` con `post_type='attachment'`). Cualquier decisión posterior puede partir de ese estado.
