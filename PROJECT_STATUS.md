# Estado del proyecto

**Fase:** inventario y auditoría inicial completados  
**Fecha:** 2026-06-18

## Fuentes identificadas

- Dump completo MariaDB: `gxvcqtpl_zorritasmexicanaclon.sql`
- Exportación WXR: `zorritasmexicanascom.WordPress.2026-06-18.xml`
- Medios: `uploads.tar.gz`
- Tema: `kingtube.tar.gz`

## Entorno

- Windows 10 Pro, Python 3.12.8, Node 22.18.0.
- Docker/Podman ausentes; se utilizará auditoría SQL incremental.
- Los originales tienen huellas SHA-256 iniciales registradas.

## Resultados

- 49 tablas detectadas; un solo prefijo probable: `wpuw_`.
- `wpuw_posts`: aproximadamente 514,186 filas.
- Señales de posts: 283,147 `post`, 231,013 `attachment`, 10 páginas y 4 revisiones.
- `wpuw_postmeta`: aproximadamente 2,785,708 filas.
- 283,001 metadatos `embed`, 230,355 `_thumbnail_id` y 231,013 `_wp_attached_file`.
- SEO principal en Rank Math; también existen tablas/metadatos de AIOSEO y Yoast.
- WXR: 21,666 items por escaneo tolerante. El XML está mal formado en la línea 1,203,894.
- Tema KingTube 1.9.0 extraído de forma aislada: 147 archivos.
- `uploads.tar.gz` tiene solo 98 miembros; incluye un `.wpstg` de 2.89 GB y no contiene el inventario histórico esperado de imágenes.
- Los manifiestos completos contienen 172 miembros del tema y 98 miembros de uploads.
- Pruebas unitarias, muestra, reanudación e idempotencia de claves SQLite aprobadas.

## Riesgos abiertos

- La discrepancia entre 514,186 registros en `posts` y 21,666 items WXR exige usar el dump como fuente principal.
- El archivo de medios parece incompleto o encapsulado dentro del respaldo WP Staging.
- No se debe extraer el `.wpstg` hasta identificar su formato y estimar el espacio requerido.
- Los conteos SQL son estimaciones incrementales; deberán confirmarse en MariaDB antes de la exportación final.

## Próximo checkpoint

Investigar el formato `.wpstg`, completar taxonomías/opciones con un parser de tuplas y diseñar el inventario real de medios antes de deduplicar.

