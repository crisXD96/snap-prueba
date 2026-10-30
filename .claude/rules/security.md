# Reglas de seguridad

Estas reglas complementan `SECURITY.md`. Si un cambio afecta alguna de las prácticas que ese archivo describe, también se actualiza.

## Secretos y configuración

- `JWT_SECRET`, `PORT` y `DB_PATH` se leen solo de variables de entorno, en `server.ts` y `shared/db.ts`. Una variable nueva se documenta en la tabla "Variables de entorno" del `README.md`. Si existe `.env.example`, Claude solo lo lee: el cambio lo hace el usuario.
- Nunca leer `.secrets/`, ni proponer cambios ahí. Nunca escribir un secreto real ni uno de ejemplo con forma de real en código, tests o docs: en los tests el secreto se genera con `randomBytes(32)`.
- Si una tarea necesita algo de `.secrets/` o de `.github/workflows/`, detenerse y avisar al usuario.

## Autenticación

- Passwords con bcrypt, costo 10. Mínimo 8 caracteres y máximo 72 bytes (lo que pasa de ahí bcrypt lo ignora). No bajar ninguno de esos límites.
- El login responde el mismo `401` y el mismo mensaje para un email inexistente y un password incorrecto.
- El login pasa por `login-limiter.ts`: 5 passwords incorrectos por IP + email en 15 min dan `429` con `Retry-After`. Solo cuenta `InvalidCredentialsError`. No activar `trust proxy` salvo que el despliegue esté detrás de un proxy.
- Los JWT se firman con HS256 y duran 24 h; `jwt.verify` siempre recibe `algorithms: ['HS256']`. El payload lleva `sub` (id del usuario) y `email`; el middleware valida los dos aunque la firma sea correcta.
- Una ruta que lee o modifica datos de un usuario usa `requireAuth` y toma el id de `getAuthUser(req)`, nunca del body ni de la query.
- No hay listados públicos ni globales: una ruta que lista recursos devuelve solo los del usuario del token. El listado de URLs es `GET /dashboard/urls`; no volver a agregar `GET /urls`.
- Antes de modificar o borrar un recurso, el service verifica que sea del usuario: `404` si no existe y `403` si es de otro.

## Datos y entradas

- SQL siempre con parámetros `?`. Nunca concatenar ni interpolar valores en una sentencia, ni siquiera nombres de columna u orden: para eso se elige entre valores fijos del código.
- La app no ejecuta DDL. Un cambio de esquema es un script nuevo en `db-scripts/` que revisa el DBA; Claude lo genera y nunca lo ejecuta.
- Solo se acortan URLs `http` y `https`. No relajar `normalizeHttpUrl` para aceptar otros esquemas (`javascript:`, `data:`, `file:`).
- Lo que manda quien visita un enlace se recorta y se limpia antes de guardarse: del referrer solo el origen, el user agent a 512 caracteres. Un header nuevo que se guarde sigue la misma regla.
- No agregar datos personales a los logs. `console.error` solo con el error, sin el body ni los headers de la petición.

## Headers HTTP

- `securityHeaders` (`shared/security-headers.middleware.ts`) va primero en `app.ts`, para que todas las respuestas lleven los headers. No relajar la CSP (`unsafe-inline`, otros orígenes): si algo nuevo la necesita, se cambia ese algo.

## SPA

- El token vive solo en memoria (estado de React en `session.tsx`). Prohibido `localStorage`, `sessionStorage`, IndexedDB y cookies para el token o los datos del usuario.
- El contenido del usuario se pinta como texto con JSX. Prohibido `dangerouslySetInnerHTML` e `innerHTML`.
- Los enlaces a URLs del usuario abren con `target="_blank"` y `rel="noreferrer"`.
- La SPA no confía en el JWT: solo lee `exp` para cerrar la sesión a tiempo. Cualquier decisión de permisos la toma el backend.

## Dependencias

- No instalar dependencias. Proponer el cambio a `package.json` con el motivo para que lo revise el equipo.
- Ante una alerta de seguridad, `npm audit --omit=dev` dice si toca producción; si la toca, se reporta al usuario antes de seguir con otra tarea. Una vulnerabilidad conocida que no se corrige se documenta en "Limitaciones conocidas" de `SECURITY.md`.
- Las actualizaciones de Dependabot que cambian de versión mayor se validan con `npm ci` y `npm run verify` en un worktree aparte, sobre la rama actual, antes de aceptarlas.
