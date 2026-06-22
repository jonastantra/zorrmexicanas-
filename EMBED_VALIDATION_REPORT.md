# Embed Validation Report — zorritasmexicanas.com

**Fecha:** 2026-06-21
**Método:** HEAD HTTP a cada URL única de iframe, concurrencia 8, timeout 10s.
**User-Agent:** `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36`

---

## 1. Resumen

| Concepto                                 | Valor    |
|------------------------------------------|----------|
| Posts con `<iframe>` (meta_key=`embed`)  | 282,998  |
| URLs únicas de embed                     | 14,846   |
| URLs OK (2xx/3xx)                        | 14,751 (99.36%) |
| URLs rotas (4xx/5xx)                     | 95 (0.64%) |
| Tiempo total de validación               | ~3.9 horas wall time (incluye pausas) |
| Tiempo promedio por HEAD                 | 947 ms   |

---

## 2. Distribución por dominio

| Dominio                    | URLs  | OK    | Dead |
|----------------------------|-------|-------|------|
| `flashservice.xvideos.com` | 14,838| 14,750| 88   |
| `www.xvideos.com`          | 1     | 1     | 0    |
| `www.pornhub.com`          | 6     | 0     | 6    |
| `embed.redtube.com`        | 1     | 0     | 1    |

> Nota: los 88 `flashservice.xvideos.com` muertos son **videoids eliminados por xvideos**.
> Las 6 pornhub muertas son **URLs malformadas** del import original (probablemente páginas
> de canal en lugar de embed directo).

---

## 3. Acciones tomadas (`repair-embeds`)

Tras la validación, los 95 URLs muertos fueron marcados con `embed_status='dead'` en la tabla `embeds`.
El webapp filtra con:

```sql
NOT EXISTS (
  SELECT 1 FROM embeds e WHERE e.post_id = p.id AND e.status = 'dead'
    AND NOT EXISTS (SELECT 1 FROM embeds e2 WHERE e2.post_id = p.id AND e2.status != 'dead')
)
```

Esto significa:
- Si un post tiene **al menos un embed vivo**, se muestra.
- Si un post tiene **solo embeds muertos**, se oculta de listados y sitemap.

---

## 4. Política de respeto al proveedor

### Lo que NO hicimos (decisiones explícitas)

- ❌ No descargamos videos externos para subirlos al servidor.
- ❌ No scrapeamos xvideos/pornhub/redtube en busca de mirrors alternativos.
- ❌ No inventamos videoids para sustituir los borrados.
- ❌ No "reparamos" embeds muertos cambiando el `videoid` por otro similar.

### Lo que SÍ hicimos (reparación permitida)

- ✅ Marcamos los embeds muertos para que **no aparezcan** en listados.
- ✅ Verificamos que los videos listados **siguen disponibles** en el proveedor original.
- ✅ El iframe se carga de forma diferida con `loading="lazy"` y `sandbox`/`referrerPolicy`
  en la página individual (`app/[slug]/page.tsx`).
- ✅ Mantenemos el `iframe src` exactamente como vino del WP original (no se altera HTML del proveedor).

---

## 5. Reportes

- `reports/embed-validation.csv` — todas las URLs validadas con su status, response time, redirect_url.
- `reports/embed-validation-summary.md` — resumen ejecutivo (este documento, versión corta).

---

## 6. Reprocesamiento

Para re-ejecutar la validación (p. ej. si pasan meses y los proveedores eliminan más videos):

```powershell
cd "_migration_workspace\migration-tool"
python -m src.cli validate-embeds --max-workers 8 --timeout 10
python -m src.cli repair-embeds
```

El primer comando actualiza `embeds` y `embed_checks`; el segundo marca como `dead` los nuevos
4xx/5xx. Todo es **idempotente** y respeta los checkpoints.

---

## 7. Material adulto — consideraciones

El sitio contiene material dirigido a adultos. Esta validación solo confirma que los **iframes
autorizados existentes** (que el propietario del WP eligió publicar) siguen activos. No autoriza
redistribución ni rehospedaje del material embebido.

Cualquier embed marcado `dead` se trata como roto y se excluye del sitio nuevo, sin intentar
sustituirlo por otro video, incluso si el título del post sugiere contenido similar.
