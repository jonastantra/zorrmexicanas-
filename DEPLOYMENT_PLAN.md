# Deployment Plan — zorritasmexicanas.com

**Fecha:** 2026-06-21
**Stack destino:** Next.js 16 + TypeScript + Tailwind + better-sqlite3 (SQLite local)
**Entorno actual:** dev (`http://localhost:3000`)
**Producción objetivo:** VPS con Node.js 22+, dominio `zorritasmexicanas.com`

---

## 1. Pre-requisitos del servidor

| Recurso     | Mínimo              | Recomendado       |
|-------------|---------------------|-------------------|
| CPU         | 2 vCPU              | 4 vCPU            |
| RAM         | 4 GB                | 8 GB              |
| Disco       | 30 GB SSD           | 50 GB SSD         |
| Node.js     | 22 LTS              | 22 LTS            |
| SQLite      | 3.40+               | 3.45+             |

Sin Docker (no es necesario; el build de Next.js es self-contained).

---

## 2. Archivos a desplegar

```
zorritasmexicanas/
├── zor3convertido/webapp/           ← aplicación Next.js
│   ├── .next/                        (build output, ~200 MB)
│   ├── public/                       (assets estáticos)
│   ├── app/                          (rutas)
│   ├── components/                   (componentes React)
│   ├── lib/                          (lógica de DB)
│   ├── node_modules/                 (excluir; reinstalar)
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── middleware.ts
│   └── redirects.data.json           (788 KB, regenerable)
│
├── _migration_workspace/state/migration.db    ← BD canónica (1.04 GB)
├── _migration_workspace/exports/              ← (referencia, no se sirve)
│
└── DEPLOYMENT_PLAN.md
```

### Lo que NO se sube al repo público

- `migration.db` (1 GB) → distribuir como asset privado o regenerar localmente
- `_migration_workspace/backups/` → conservar local
- `node_modules/` → reinstalar con `npm ci --omit=dev`

---

## 3. Pasos de despliegue

### Paso 1: Preparar el servidor

```bash
# Crear usuario no-root
useradd -m -s /bin/bash zorritas
# Instalar Node 22 (usando nvm)
sudo -u zorritas bash -c 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash'
sudo -u zorritas bash -c 'nvm install 22 && nvm use 22 && nvm alias default 22'
```

### Paso 2: Subir el código

```bash
# Desde el dev local
rsync -avz --exclude='node_modules' --exclude='.next' \
  ./zor3convertido/webapp/ zorritas@servidor:/home/zorritas/app/

rsync -avz ./ _migration_workspace/state/migration.db \
  zorritas@servidor:/home/zorritas/data/migration.db
```

### Paso 3: Instalar dependencias y compilar

```bash
cd /home/zorritas/app
npm ci --omit=dev
npm run build
```

El primer build tarda ~60-120s. Genera `.next/` con el bundle.

### Paso 4: Configurar variable de entorno

```bash
# /home/zorritas/app/.env.production
MIGRATION_DB_PATH=/home/zorritas/data/migration.db
NODE_ENV=production
PORT=3000
```

### Paso 5: Levantar con `pm2` o systemd

Opción A — `pm2` (recomendado):

```bash
npm install -g pm2
pm2 start npm --name zorritas -- run start
pm2 save
pm2 startup
```

Opción B — systemd unit:

```ini
# /etc/systemd/system/zorritas.service
[Unit]
Description=Zorritas Mexicanas - Next.js
After=network.target

[Service]
Type=simple
User=zorritas
WorkingDirectory=/home/zorritas/app
ExecStart=/home/zorritas/.nvm/versions/node/v22.18.0/bin/npm run start
Restart=on-failure
EnvironmentFile=/home/zorritas/app/.env.production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now zorritas
```

### Paso 6: Reverse proxy con nginx

```nginx
# /etc/nginx/sites-available/zorritasmexicanas.com
server {
    listen 80;
    server_name zorritasmexicanas.com www.zorritasmexicanas.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name zorritasmexicanas.com www.zorritasmexicanas.com;

    ssl_certificate     /etc/letsencrypt/live/zorritasmexicanas.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zorritasmexicanas.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Static assets (long cache)
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Everything else to Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo certbot --nginx -d zorritasmexicanas.com -d www.zorritasmexicanas.com
sudo systemctl reload nginx
```

---

## 4. Validación post-deploy

### Checklist inmediato

- [ ] `curl -I https://zorritasmexicanas.com/` → 200
- [ ] `curl -I https://zorritasmexicanas.com/young-small-mexican-big-dick` → 200
- [ ] `curl -I https://zorritasmexicanas.com/young-small-mexican-big-dick-2` → 301 a canónico
- [ ] `curl -I https://zorritasmexicanas.com/categoria/amateur-mexicano` → 200
- [ ] `curl -I https://zorritasmexicanas.com/sitemap.xml` → 200
- [ ] `curl https://zorritasmexicanas.com/sitemap.xml | head -3` → XML válido
- [ ] `curl https://zorritasmexicanas.com/robots.txt` → contiene Sitemap
- [ ] Probar 3 iframes manualmente (xvideos, pornhub) → cargan sin error
- [ ] Probar 1 thumbnail desde CDN externo → imagen renderiza
- [ ] `pm2 logs zorritas` → sin errores en startup

### Verificación de SEO

1. **Google Search Console** → validar dominio y subir `sitemap.xml`.
2. Esperar 24-48 horas y revisar cobertura indexada.
3. Comparar `pages indexed` antes vs después de la migración.
4. Monitorear 404 en Search Console; los esperados son URLs no migradas (viejas query strings).
5. Verificar que los redirects 301 funcionan desde la URL vieja del WP.

### Monitoreo continuo

```bash
# Logrotate para pm2
pm2 install pm2-logrotate

# Alertas básicas
pm2 set zorritas max_memory_restart 1G
```

---

## 5. Rollback plan

Si algo sale mal:

### Opción A: Rollback completo al WP original

1. Apuntar DNS del dominio a la IP del servidor WP antiguo (mismo o diferente).
2. Mantener la BD nueva (`migration.db`) intacta para diagnóstico.

### Opción B: Rollback parcial (mantener Next.js, ajustar)

```bash
# Restaurar backup de migration.db
ssh zorritas@servidor "cp /home/zorritas/data/migration.db.backup /home/zorritas/data/migration.db"
pm2 restart zorritas
```

---

## 6. Post-producción: monitoreo y mantenimiento

### Diario (automatizable)

- Health check: `curl -fsS https://zorritasmexicanas.com/ || alert`
- pm2 logs revisión (errores 500)

### Semanal

- Revisar Search Console: cobertura, errores, posiciones
- Revisar `pm2 logs` por patrones anómalos

### Mensual

- Re-correr `python -m src.cli validate-embeds` para detectar nuevos embeds muertos
- Re-correr `python -m src.cli generate-redirects` si se añadieron posts nuevos
- Verificar que el CDN externo sigue activo

### Trimestral

- `npm audit` y actualizar parches de seguridad
- Rotación del log de redirects

---

## 7. Cosas que faltan (no bloqueantes para deploy)

- [ ] Validar dominio final en `lib/site.ts` (placeholder actual).
- [ ] Implementar búsqueda full-text (FTS5 en SQLite ya soporta).
- [ ] Panel admin mínimo (D-006 — el admin WP clásico queda inerte).
- [ ] Caché HTTP/CDN para estáticos en producción.
- [ ] Almacenamiento de imágenes en S3/R2 si el CDN externo falla.

---

## 8. Contacto / Escalación

- Logs: `pm2 logs zorritas` (vía SSH)
- Backup local: `/home/zorritas/data/migration.db.backup` (diario, retenido 7 días)
- Disco lleno: `/var/log/zorritas-disk-alert.log` (script cron opcional)
