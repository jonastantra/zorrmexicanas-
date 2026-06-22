# Mapa funcional KingTube → Next.js

Referencia auditada: `kingtube/kingtube`, versión 1.9.0.

## Implementado

- Reproductor responsive para iframe.
- Miniaturas locales, duración, vistas y categorías.
- Conteo persistente de vistas con deduplicación diaria.
- Likes/dislikes con prevención de votos repetidos.
- Compartir mediante Web Share o portapapeles.
- Videos relacionados y listados populares.
- SEO por video con `VideoObject`, breadcrumbs, canonical y video sitemap.
- Zonas publicitarias configurables: cabecera, debajo del reproductor, lateral superior/inferior, relacionados y footer.
- Panel administrativo protegido.
- Registro de salud de videos y reemplazo de enlaces muertos.

## Próxima capa modular

- Bloques de portada configurables: recientes, más vistos, largos, populares, aleatorios y por categoría.
- Edición de videos, categorías, etiquetas, título, descripción, iframe y miniatura.
- Imágenes por categoría.
- Trailers o rotación de miniaturas al pasar el mouse.
- Comentarios y reportes.
- Actores.
- Envío de videos y perfiles/membresía.
- Blog y galerías de fotos.
- Reproductor de archivos propios con varias resoluciones.
- Anuncios dentro del reproductor, pre-roll y mid-roll.

Las funciones de membresía, envío público y anuncios dentro del reproductor deben activarse por módulo: aumentan superficie de seguridad y no todos los sitios las necesitan.
