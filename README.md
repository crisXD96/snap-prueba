# Snap

Acortador de URLs con analíticas: API en Express + SQLite y una interfaz web en React servida por el mismo servidor.

## Requisitos

- Node.js 24 o superior (usa `node:sqlite` y ejecuta TypeScript directo en desarrollo).
- La base `snap.db` con el esquema de [`db-scripts/`](db-scripts/). Los scripts los aplica el DBA tras revisión; la aplicación no crea ni modifica el esquema.

## Instalación

```bash
npm install
```

> En PowerShell con la política `AllSigned`, `npm` falla porque `npm.ps1` no está firmado. Usa `npm.cmd` en su lugar (`npm.cmd install`, `npm.cmd run dev`) o una terminal de Command Prompt o Git Bash.

## Variables de entorno

| Variable | Obligatoria | Por defecto | Uso |
|---|---|---|---|
| `JWT_SECRET` | Sí | — | Firma y verifica los tokens. Sin ella el servidor no arranca. |
| `PORT` | No | `3000` | Puerto del servidor. |
| `DB_PATH` | No | `snap.db` | Ruta de la base SQLite. |
| `NODE_ENV` | En producción | — | `production` en el servidor desplegado, para que Express no use su modo de desarrollo. Se define en el entorno del servidor, no en `npm start`. |

Para desarrollo local, `npm run dev` carga un archivo `.env` en la raíz si existe. Cópialo de `.env.example` y pon en `JWT_SECRET` un valor aleatorio:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`.env` está en el `.gitignore` y nunca se versiona. También puedes definir la variable solo en la terminal (`$env:JWT_SECRET = ...`) y no usar `.env`.

Al detenerlo con Ctrl+C (o con `SIGTERM` en un servidor), deja terminar las peticiones en curso y cierra la base antes de salir.

## Interfaz Web (Frontend)

Una SPA en React 19 + Vite que consume la API. En producción Express la sirve desde el mismo origen, así que no hace falta CORS ni configurar URLs.

### Cómo arrancarla

**Desarrollo** (dos terminales, con recarga en caliente):

```bash
npm run dev       # API en http://localhost:3000 (requiere JWT_SECRET)
npm run dev:web   # SPA en http://localhost:5173 (o el siguiente puerto libre)
```

Abre la URL que imprime Vite. Su proxy reenvía `/auth`, `/urls`, `/dashboard`, `/health` y los códigos cortos a la API en el puerto 3000.

**Producción**:

```bash
npm run build     # compila la API a dist/ y la SPA a dist/web/
npm start         # sirve API y SPA en http://localhost:<PORT>
```

Abre `http://localhost:3000` (o el `PORT` configurado).

Si se despliega detrás de un proxy o balanceador, hay que activar `app.set('trust proxy', 1)` en `src/app.ts`, con el número de proxies delante. Sin eso, el límite de intentos de login ve a todos los usuarios con la IP del proxy. Sin proxy no se activa: cualquiera podría falsificar su IP con `X-Forwarded-For`.

### Pantallas

- **Inicio de sesión y registro**: portada con lo que hace Snap y formularios con los mensajes de error que devuelve la API (credenciales incorrectas, email ya registrado, validaciones, demasiados intentos).
- **Panel**:
  - Formulario para acortar una URL, con el enlace corto listo para copiar. La URL nueva aparece resaltada en la lista.
  - Métricas del periodo (7, 30 o 90 días): clicks del periodo y variación contra el anterior, clicks totales y URLs sin clicks. **Se actualizan solas cada 30 segundos** mientras la pestaña está visible; el botón **Actualizar métricas** lo hace al momento.
  - Gráfica de clicks por día con un resumen del periodo (total y día con más clicks). Con lector de pantalla, la gráfica se lee como una tabla de clicks por día.
  - Lista paginada de tus URLs con clicks, fechas, **Copiar enlace** y borrado con confirmación. En celular y tablet vertical cada URL se muestra como tarjeta.

Tiene tema claro y oscuro según el sistema, íconos de [Lucide](https://lucide.dev) y animaciones de entrada, que se desactivan si el sistema pide reducir el movimiento.

La vista depende de la sesión, no de la URL: en `/` se muestra el panel si hay sesión y el login si no.

### Sesión

El token JWT viaja en la cookie `snap_session`, que es `HttpOnly` (el JavaScript de la página no puede leerla), `Secure` y `SameSite=Strict`. La SPA nunca toca el token ni lo guarda en `localStorage` o `sessionStorage`. Por eso:

- **Recargar la página mantiene la sesión**: al cargar, la SPA pregunta a `GET /auth/me` y, si la cookie sigue vigente, entra directo al panel.
- La sesión es la misma en todas las pestañas: **Cerrar sesión** (`POST /auth/logout`) la cierra en todas.
- Si el token expira (24 h) o el backend responde `401`, la app vuelve al login con el aviso *"Tu sesión ha expirado. Por favor, inicia sesión de nuevo."*
- Un `403` no cierra la sesión: en esta API significa que la URL pertenece a otro usuario.
- `Secure` exige HTTPS. Los navegadores lo aceptan en `http://localhost`, pero en cualquier otro host sin HTTPS la cookie no se guarda y la sesión no funciona.

Los clientes que no son la SPA pueden seguir usando el `token` del body del login con `Authorization: Bearer`.

### Estructura

```
src/
├── app.ts                    # monta la SPA después de la API (createApp recibe webDir)
├── server.ts                 # sirve dist/web
├── modules/web/
│   ├── web.routes.ts         # express.static de la carpeta del build
│   └── __tests__/
└── web/                      # la SPA (raíz de Vite)
    ├── index.html
    ├── main.tsx
    ├── App.tsx               # login/registro o panel según la sesión
    ├── api.ts                # cliente de la API: Bearer, errores { error }, respuestas no JSON
    ├── session.tsx           # sesión de la cookie (/auth/me), expiración y manejo del 401
    ├── format.ts             # fechas en hora del centro de México, porcentajes, URL corta
    ├── styles.css            # tema claro y oscuro, diseño adaptable
    ├── vite.config.ts        # proxy de desarrollo y salida a dist/web
    ├── tsconfig.json         # DOM + JSX, separado del backend
    ├── components/           # LoginForm, RegisterForm, Dashboard, Metrics, TrendChart,
    │                         # ShortenForm, UrlList, CopyButton
    └── __tests__/            # tests de la SPA (jsdom + Testing Library)
```

### Limitaciones conocidas

- El backend no tiene alias personalizado, fecha de expiración ni recuperación de contraseña, así que la interfaz tampoco.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática (`node --watch`) |
| `npm run dev:web` | SPA con Vite y proxy a la API |
| `npm run build` | Compila API y SPA a `dist/` |
| `npm start` | Arranca la versión compilada |
| `npm test` | Tests del backend (Node) y de la SPA (jsdom) |
| `npm run typecheck` | Revisa tipos del backend y de la SPA |
| `npm run verify` | `typecheck` y `test`: lo que debe pasar antes de cada commit |
