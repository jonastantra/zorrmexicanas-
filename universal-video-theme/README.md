# Universal Video Theme

Plantilla reutilizable basada en la aplicación Next.js de este proyecto y en el inventario funcional de KingTube.

## Tecnología

- Next.js/React para las páginas y el panel.
- SQLite para el catálogo importado.
- Una segunda SQLite pequeña para vistas, votos, anuncios y ajustes.
- Scripts Python para importar, revisar videos y descargar miniaturas.

No es un tema de WordPress: es el equivalente moderno de un tema, con componentes y configuración por sitio. Para cambiar toda la plantilla se modifican los componentes compartidos y los tokens CSS; para cambiar un solo sitio se usa `site.config.ts` y sus variables de entorno.

## Crear otro sitio

1. Ejecutar `New-VideoSite.ps1 -Destination C:\sitios\mi-sitio`.
2. Copiar o generar la base del catálogo en `data/catalog.db`.
3. Copiar `.env.example` como `.env.production`.
4. Cambiar dominio, credenciales y rutas.
5. Editar `site.config.example.ts` y renombrarlo como `lib/site.config.ts`.
6. Ejecutar `npm install`, `npm run build` y `npm run start`.

Los archivos de medios y las bases reales se excluyen del paquete para que el tema siga siendo pequeño y portable.
