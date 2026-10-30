# Política de seguridad

## Versiones con soporte

| Versión | Soporte |
|---|---|
| 0.1.x | ✅ |

## Cómo reportar una vulnerabilidad

**No abras un issue con los detalles.** Escribe directamente al mantenedor del repositorio por GitHub e incluye:

- Qué componente afecta (API, interfaz web, scripts de base de datos).
- Pasos para reproducirla y el impacto esperado.
- Si existe, una propuesta de corrección.

Una vez corregida, el reporte se documenta en el commit del arreglo.

## Prácticas del proyecto

### Secretos

- `JWT_SECRET` se lee solo de una variable de entorno. Sin ella, el servidor no arranca.
- Nunca se versionan secretos, archivos `.env`, certificados ni bases de datos: el `.gitignore` excluye `.secrets/`, `*.env`, `certs/`, `prod.env`, `*.db*` y los respaldos.

### Autenticación

- Los passwords se guardan con bcrypt (costo 10). Se exigen al menos 8 caracteres y se rechazan los que pasan de 72 bytes, porque bcrypt ignora lo que sigue.
- El login devuelve el mismo error para un email inexistente y para un password incorrecto, para no revelar qué cuentas existen.
- Los JWT se firman con HS256, duran 24 h, y la verificación fija el algoritmo para que el token no pueda elegirlo.
- En la interfaz web el token vive **solo en memoria**: nunca se guarda en `localStorage`, `sessionStorage` ni cookies.

### Datos y entradas

- Todas las consultas SQL usan parámetros (`?`); el código nunca concatena valores del usuario en SQL.
- Solo se acortan URLs `http` y `https`.
- Ninguna ruta lista las URLs de otros usuarios: el único listado es `GET /dashboard`, con las del usuario autenticado.
- De cada click solo se guarda el origen del referrer (sin ruta ni query, que pueden traer datos personales) y el user agent recortado a 512 caracteres.
- La interfaz web muestra el contenido del usuario como texto (React lo escapa) y abre los enlaces externos con `rel="noreferrer"`.
- El esquema de la base se cambia solo con los scripts de `db-scripts/`, que revisa el DBA; la aplicación no ejecuta DDL.

## Limitaciones conocidas

- La API no limita los intentos de login ni agrega headers de seguridad HTTP (CSP, `X-Content-Type-Options`, etc.).
- `npm audit` reporta vulnerabilidades en `tinypool` (2 críticas) y `@vitest/mocker` (1 moderada), que llegan por `vitest`. Son dependencias de desarrollo que no llegan a producción: `npm audit --omit=dev` no encuentra ninguna. Corregirlas exige actualizar a Vitest 5.
