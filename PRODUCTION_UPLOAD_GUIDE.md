# Publicación segura: GitHub + EasyPanel

## Recomendación

Usar un VPS con EasyPanel y el `Dockerfile` incluido. Este proyecto utiliza:

- SQLite persistente de aproximadamente 1.2 GB.
- Base operativa para vistas, likes, anuncios y configuración.
- Aproximadamente 0.85 GB de miniaturas locales.
- Scripts Python de mantenimiento de larga duración.

Por eso necesita un contenedor con volumen persistente. Vercel está orientado a
funciones sin estado; para usarlo habría que migrar SQLite a una base externa,
las imágenes a Blob/S3/R2 y los procesos Python a otro trabajador.

## Qué se sube a GitHub

- `zor3convertido/webapp/app`
- `zor3convertido/webapp/components`
- `zor3convertido/webapp/lib`
- `package.json` y `package-lock.json`
- `Dockerfile`, `.dockerignore`, configuración Next.js y middleware
- Scripts Python de mantenimiento
- Documentación y archivos de despliegue

## Qué no se sube a GitHub

- `_migration_workspace/state/migration.db`
- `_migration_workspace/backups` (actualmente más de 12 GB)
- `public/media/thumbs` (aproximadamente 0.85 GB)
- `.env.production`
- `node_modules`, `.next`, logs y archivos de bloqueo
- SQL, XML, TAR/RAR originales
- El tema KingTube usado únicamente como referencia

Nada de lo anterior se elimina: permanece local y se copia directamente al
servidor.

## Preparar el repositorio

Desde la raíz:

```powershell
git status --short
git add .gitignore PRODUCTION_UPLOAD_GUIDE.md
git add zor3convertido/webapp
git add *.py *.ps1 *.md deploy universal-video-theme
git status --short
```

Revisar que no aparezcan `.db`, `.env.production`, `thumbs`, `backups`,
`node_modules` ni `.next`. Después:

```powershell
git commit -m "Preparar aplicación de video para producción"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

## EasyPanel

1. Crear un proyecto y una aplicación desde el repositorio GitHub.
2. Elegir compilación con Dockerfile:
   `zor3convertido/webapp/Dockerfile`.
3. Establecer como contexto/directorio de aplicación:
   `zor3convertido/webapp`.
4. Crear un volumen persistente montado en `/data`.
5. Configurar:

```env
NEXT_PUBLIC_BASE_URL=https://zorritasmexicanas.com
MIGRATION_DB_PATH=/data/migration.db
RUNTIME_DB_PATH=/data/site-runtime.db
ADMIN_USER=admin
ADMIN_PASSWORD=UNA_CLAVE_NUEVA_LARGA_Y_UNICA
PORT=3000
```

6. Configurar el dominio y SSL en EasyPanel.
7. Copiar por SFTP/SSH:

```text
_migration_workspace/state/migration.db
    → /data/migration.db

zor3convertido/webapp/data/site-runtime.db
    → /data/site-runtime.db

zor3convertido/webapp/public/media/thumbs/*
    → volumen o directorio persistente de miniaturas
```

Para las miniaturas, la aplicación debe montar el volumen sobre:
`/app/public/media/thumbs`, o configurar un segundo volumen en esa ruta.

## Alternativas

### Railway

Conecta GitHub, detecta Docker y permite añadir un volumen. Montar `/data` para
SQLite y otro volumen/ruta para miniaturas. Es sencillo, pero el almacenamiento
y tráfico pueden costar más que un VPS.

### Render

Crear un servicio web Docker de pago y añadir un disco persistente. Solo lo que
esté dentro del punto de montaje persiste entre despliegues.

### VPS + EasyPanel

Es la opción recomendada: control total del disco, los scripts Python pueden
ejecutarse como procesos/cron y no obliga a migrar SQLite.

## Validación antes de cambiar DNS

- `/` responde 200.
- `/admin` responde 401 sin credenciales.
- Una entrada responde 200 y muestra iframe/JPG.
- `/sitemap.xml`, `/video-sitemap.xml` y `/robots.txt` responden 200.
- Los sitemaps utilizan el dominio real, no `localhost`.
- Reiniciar el contenedor no borra likes, configuración, base ni miniaturas.
- Crear un backup de `/data` antes de cada despliegue importante.
