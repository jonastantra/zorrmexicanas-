# Plan de migración

## Objetivo

Conservar URLs, contenido válido, medios correctos, embeds autorizados y señales SEO del WordPress original, eliminando duplicación únicamente en el nuevo conjunto de datos.

## Fases

1. Inventario reproducible del sistema y las fuentes.
2. Manifiestos completos de archivos comprimidos y extracción aislada del tema.
3. Auditoría incremental del dump SQL y contraste con WXR.
4. Inventario y deduplicación escalable de medios.
5. Clasificación y canonicalización de entradas.
6. Validación de miniaturas y embeds.
7. Exportación JSONL limpia y carga en PostgreSQL.
8. Aplicación Next.js, preservación SEO y validación comparativa.

## Reglas permanentes

- Los cuatro archivos de entrada son de solo lectura.
- No se elimina contenido: los descartes se proponen y posteriormente se ponen en cuarentena.
- Los procesos extensos escriben checkpoints en SQLite y admiten reanudación.
- Los reportes extensos se conservan como CSV/JSONL; la documentación contiene solo resúmenes.
- No se descargan ni vuelven a alojar videos externos.

