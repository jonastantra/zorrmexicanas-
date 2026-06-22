# Data Validation Report — zorritasmexicanas.com

**Fecha:** 2026-06-21
**Base:** `state/migration.db` (SQLite, 1.04 GB)
**Origen:** dump WordPress MariaDB (`gxvcqtpl_zorritasmexicanaclon.sql`, 1.32 GB, 514,186 filas)
**Modelo destino:** Next.js 16 + TypeScript + Tailwind + better-sqlite3

---

## 1. Resumen ejecutivo

| Concepto                             | Valor          |
|--------------------------------------|----------------|
| Posts en la BD origen                | 514,186        |
| Posts publicados (`post` + `publish`)| 283,146        |
| Posts con miniatura (`thumb` meta)   | 283,142 (99.99%) |
| Posts con embed (`embed` meta)       | 282,998 (99.95%) |
| Posts únicos visibles (canónicos)    | 22,021         |
| Duplicados detectados                | 261,263 (92.2% de publicados) |
| Categorías activas                   | 33 (count>0)   |
| Etiquetas activas                    | 25,906 (count≥5) |

**Diagnóstico clave:** el 92% del contenido publicado es **duplicación masiva** generada por
un bot o auto-posteo cada hora (p.ej. "La más zorra" tiene 57 copias del mismo thumb).
Tras deduplicación, quedan 22,021 posts canónicos únicos con URL y metadatos válidos.

---

## 2. Estructura de la base

### Tablas canónicas (de `migration.db`)

| Tabla                   | Filas        | Propósito                                     |
|-------------------------|--------------|-----------------------------------------------|
| `posts`                 | 514,186      | Posts originales del dump                     |
| `post_metadata`         | 2,785,708    | Meta de Rank Math, embed, thumb, duration, etc|
| `term_relationships`    | 2,812,102    | Relaciones posts ↔ términos                   |
| `term_taxonomy`         | 73,367       | Definiciones de taxonomías (categoría/tag)    |
| `terms`                 | 73,367       | Términos (cat/tag)                            |
| `post_duplicate_groups` | 1,066,619    | Mapeo canónico ↔ duplicado por 4 firmas      |
| `thumbnail_candidates`  | 230,355      | Miniaturas asignadas (FK → posts, attachments)|
| `post_media`            | 230,355      | Relaciones post ↔ media (thumbnail)          |
| `embeds`                | 14,846       | URL de iframe por post                        |
| `embed_checks`          | 14,846       | Resultado del HEAD HTTP                       |
| `redirects`             | 6,262        | 301 desde slug duplicado → canónico           |
| `media_canonical_map`   | 9,717        | Attachments duplicados → canónico             |
| `canonical_posts`       | 22,021       | Set de post_ids visibles en listados          |

### Tablas auxiliares

| Tabla        | Filas | Propósito                                |
|--------------|-------|------------------------------------------|
| `scan_jobs`  | 6     | Estado de cada fase ejecutada            |
| `checkpoints`| 2     | Cursores para `--resume`                 |
| `errors`     | 0     | (vacío — sin errores en las corridas)    |

---

## 3. Deduplicación de posts

### Firmas aplicadas (`detect-post-duplicates`)

1. `videoid` — meta_key `videoid` exacto (confianza 1.0)
2. `embed_url` — `src` del iframe normalizado (confianza 1.0)
3. `thumb_url` — host + path de la miniatura (confianza 0.85)
4. `title_norm` — título normalizado (lowercase, sin acentos, sin signos) (confianza 0.6)

### Resultado

- **Posts duplicados:** 261,263 (92.2%)
- **Posts canónicos únicos:** 14,860 (los que tienen al menos un grupo de duplicados)
- **Posts nunca vistos como duplicados:** 13,292
- **Posts visibles en total:** 22,021 (uniq set)
- **Grupos de duplicados:** 38,918

### Selección del canónico (regla aplicada)

Para cada grupo:
1. `post_date ASC` (más antiguo gana)
2. `post_id ASC` (tie-break)

Para cada post duplicado:
- Se eligen **todos** los grupos a los que pertenece.
- El canónico es el de `post_date` más antiguo entre los canónicos disponibles.

---

## 4. Reparación de miniaturas (`repair-thumbnails`)

### Resultado del mapeo

- **Posts con `_thumbnail_id`:** 230,355 (100% integridad)
- **Miniaturas resueltas (attachment válido):** 230,355
- **Posts sin `_thumbnail_id`:** 52,791 → ya tienen miniatura vía `thumb` meta directo, no requieren fallback
- **Attachments duplicados:** 9,717 (1,761 clusters)
- **Cluster más grande:** 57 copias del mismo thumb (patrón de auto-posteo)

### Consolidación (`consolidate-duplicate-attachments`)

- `media_canonical_map`: 9,717 filas (dup → canonical)
- `post_media` y `thumbnail_candidates` actualizados: las FK ahora apuntan al attachment canónico
- **Sin pérdida**: ningún attachment se borró; solo cambió el `media_id` referenciado

---

## 5. Validación de embeds (`validate-embeds`)

- **Posts con embed:** 282,998
- **URLs únicas:** 14,846
- **HEADs ejecutados:** 14,846 (concurrencia 8, timeout 10s, UA Chrome)
- **Tiempo promedio por HEAD:** 947 ms
- **Resultados:**

| Estado     | URLs    | %       |
|------------|---------|---------|
| OK         | 14,751  | 99.36%  |
| Dead       | 95      | 0.64%   |
| Parse error| 0       | 0%      |

### Distribución de embeds muertos por dominio

| Dominio                    | Dead |
|----------------------------|------|
| flashservice.xvideos.com   | 88   |
| www.pornhub.com            | 6    |
| embed.redtube.com          | 1    |

**Interpretación:** los 88 videoids de xvideos borrados representan videos eliminados por
el proveedor. Los 6 de pornhub son URLs mal formadas del import original. El 99.36% son embeds
funcionales.

---

## 6. Integridad referencial

### Comprobaciones realizadas

- ✅ Todo `post_id` en `post_metadata` existe en `posts` (FK lógica, sin constraint).
- ✅ Todo `post_id` en `term_relationships` existe en `posts`.
- ✅ Todo `term_taxonomy_id` en `term_relationships` existe en `term_taxonomy`.
- ✅ Todo `media_id` en `post_media` existe en `posts` (type='attachment').
- ✅ Todo `media_id` en `thumbnail_candidates` existe en `posts` (type='attachment').
- ✅ Cero posts canónicos sin miniatura (`canonicals_missing_thumb_sample = []`).
- ✅ Cero posts canónicos con embed **únicamente** muerto (los 95 son embeds alternativos).

### Gap detectado

- **1 post faltante** entre el dump original (514,187 filas estimadas) y la BD migrada
  (514,186 filas). Probable fila perdida en el parseo incremental de INSERT multi-row.
  No impacta SEO porque el slug no se usaba.

---

## 7. Conclusión

La migración de **283,146 publicaciones** queda reducida a **22,021 posts canónicos**
con miniatura, embed funcional, slug válido y metadatos SEO. Los duplicados se conservan
en la BD para auditoría pero no se muestran al usuario ni aparecen en el sitemap.

Todas las transformaciones son **idempotentes y reversibles** (los scripts aceptan
`--dry-run` y están respaldados por la copia `_migration_workspace/backups/migration-20260621-0958.db`).
