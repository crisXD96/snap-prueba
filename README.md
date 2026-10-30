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

Para desarrollo local se puede generar un secreto aleatorio en la terminal donde se arranca el servidor:

```powershell
$env:JWT_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Nunca lo guardes en un archivo versionado.

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

### Pantallas

- **Inicio de sesión y registro**: formularios con los mensajes de error que devuelve la API (credenciales incorrectas, email ya registrado, validaciones).
- **Panel**:
  - Formulario para acortar una URL, con el enlace corto listo para copiar.
  - Métricas del periodo (7, 30 o 90 días): clicks del periodo y variación contra el anterior, clicks totales y URLs sin clicks.
  - Gráfica de clicks por día con un resumen del periodo (total y día con más clicks) y botón **Actualizar métricas** para ver clicks nuevos sin recargar. Con lector de pantalla, la gráfica se lee como una tabla de clicks por día.
  - Lista paginada de tus URLs con clicks, fechas, **Copiar enlace** y borrado con confirmación. En celular y tablet vertical cada URL se muestra como tarjeta.

La vista depende de la sesión, no de la URL: en `/` se muestra el panel si hay sesión y el login si no.

### Sesión

El token JWT vive **solo en memoria**: por las reglas de seguridad del equipo no se guarda en `localStorage`, `sessionStorage` ni cookies. Por eso:

- Recargar la página cierra la sesión.
- Si el token expira (24 h) o el backend responde `401`, la app vuelve al login con el aviso *"Tu sesión ha expirado. Por favor, inicia sesión de nuevo."*
- Un `403` no cierra la sesión: en esta API significa que la URL pertenece a otro usuario.

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
    ├── session.tsx           # sesión en memoria, expiración y manejo del 401
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
