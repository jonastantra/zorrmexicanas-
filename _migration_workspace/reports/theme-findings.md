# Hallazgos del tema

- Tema identificado: **KingTube 1.9.0**, desarrollado por WP-Script.
- Es un tema de portal de video con portada por bloques, páginas de archivo, búsqueda, entrada individual, 404 y navegación principal.
- El reproductor depende principalmente de metadatos: `embed`, `shortcode`, `video_url` y variantes por resolución.
- La miniatura principal y las rotaciones se administran desde metaboxes propios.
- Incluye posiciones publicitarias alrededor del reproductor, cabecera, barra lateral y pie.
- La configuración controla cantidad de videos por página/fila en escritorio y móvil.
- Registra menús, widgets y bloques de videos recientes, aleatorios y de mayor duración.
- Conserva Font Awesome, Fancybox y JavaScript propio; no deben trasladarse literalmente si componentes modernos cubren la misma experiencia.
- La reconstrucción debe conservar la cuadrícula, jerarquía visual, zonas publicitarias vacías y reproductor responsivo, sin traducir PHP línea por línea.

