# Desplegar LobasMexicanas (segundo sitio, mismo motor)

LobasMexicanas usa **el mismo código** que Zorritas. No hay que copiar nada:
se crea una **segunda app en EasyPanel** apuntando al mismo repo, con sus
propias **variables de entorno** y su propia **base de datos** (que nace vacía
sola y se llena con el publicador automático).

> Los arreglos que hagamos al código sirven para los dos sitios
> automáticamente. La identidad (nombre, color, dominio) se cambia solo con
> variables.

## Pasos en EasyPanel

1. **Crear una nueva App** (servicio) en EasyPanel.
2. **Fuente:** el mismo repositorio Git `zorrmexicanas-`, rama
   `codex/production-ready`. Build context / carpeta: `zor3convertido/webapp`
   (igual que Zorritas; usa el mismo Dockerfile).
3. **Volumen persistente:** monta uno NUEVO en `/data` (su propia base, separada
   de Zorritas). No compartir el volumen con el otro sitio.
4. **Variables de entorno** (Environment) — pega estas:

```
# --- Identidad del sitio ---
NEXT_PUBLIC_SITE_NAME=Lobas Mexicanas
NEXT_PUBLIC_SITE_SHORTNAME=LobasMexicanas
NEXT_PUBLIC_SITE_MARK=LM
NEXT_PUBLIC_THEME=blue
NEXT_PUBLIC_BASE_URL=https://TU-DOMINIO-LOBAS   # tu dominio aquí
# Opcionales (si no las pones, usa textos genéricos):
# NEXT_PUBLIC_SITE_TAGLINE=Lobas mexicanas, amateur y video casero
# NEXT_PUBLIC_SITE_DESCRIPTION=...

# --- Bases de datos (en el volumen /data nuevo) ---
MIGRATION_DB_PATH=/data/migration.db
RUNTIME_DB_PATH=/data/site-runtime.db

# --- IA y automatización ---
OPENROUTER_API_KEY=tu-api-key-de-openrouter
AUTO_IMPORT_SECRET=pon-aqui-una-cadena-larga-al-azar

# --- Acceso admin (si tu proxy lo usa) ---
ADMIN_USER=admin
ADMIN_PASSWORD=pon-una-contraseña
```

5. **Dominio:** apunta tu dominio (DNS) a esta app de EasyPanel, igual que
   hiciste con Zorritas, y pon ese mismo dominio en `NEXT_PUBLIC_BASE_URL`.
6. **Desplegar.** En el primer arranque:
   - La base `/data/migration.db` se **crea vacía sola** (esquema automático).
   - El publicador automático empieza a descubrir, reescribir y publicar 20/día.
   - Verás el color **azul** y el nombre **Lobas Mexicanas**.

## Después del primer deploy
- Entra a `/admin/auto-import` (con tu usuario admin) para ver la cola.
- Si quieres acelerar el arranque, dale a **🔎 Buscar candidatos** → **✍️
  Reescribir** → **🗓️ Programar 20**. O simplemente espera: se hace solo.
- Todo lo demás (autocorrección de textos, mejora, publicar vencidos) funciona
  igual que en Zorritas, sin tocar nada.

## Notas
- **No comparte base con Zorritas**: cada sitio tiene su `/data`.
- El color sale de `NEXT_PUBLIC_THEME` (`rose` = Zorritas, `blue` = Lobas). Se
  pueden agregar más temas en `lib/site.ts`.
- Si algún día quieres textos SEO específicos de Lobas, se ajustan en el código
  (afectaría a ambos salvo que se hagan condicionales) — avísame y lo vemos.
