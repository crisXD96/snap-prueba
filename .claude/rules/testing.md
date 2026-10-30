---
paths:
  - "src/**"
  - "vitest.config.ts"
---

# Reglas de testing

## Dónde y cómo

- Vitest con dos proyectos (`vitest.config.ts`): `backend` corre en Node los `src/**/__tests__/**/*.test.ts` fuera de `src/web`, y `web` corre en jsdom los `src/web/**/__tests__/**/*.test.{ts,tsx}`.
- Los tests van en `__tests__/` junto al módulo: `src/modules/<nombre>/__tests__/<nombre>.test.ts` o `src/web/__tests__/`.
- Sin globals de Vitest: importar `describe`, `it`, `expect`, `vi` de `vitest` en cada archivo.
- Correr uno: `npx vitest run <archivo>`, `npx vitest run --project backend` o `-t "nombre del test"`. Antes de dar algo por terminado y antes de cada commit: `npm run verify` (typecheck y tests).

## Nombres

- `describe` nombra la pieza (`'API de urls'`, `'servicio de dashboard'`, `'POST /auth/login'`) y cada `it` describe el comportamiento en español: `'responde 409 cuando el email ya está registrado'`, `'rechaza el login con password incorrecto'`.
- En los tests de la API, el nombre dice el código HTTP y la condición.

## Backend

- Base real en memoria con `createTestDatabase()` de `src/shared/__tests__/test-database.ts`: aplica en orden todos los scripts de `db-scripts/`, así que un script nuevo entra solo. Nunca escribir el esquema a mano en un test, ni armar otra base en el archivo, ni usar `snap.db`.
- Para probar una base a medio migrar, pasar menos scripts: `createTestDatabase(SCHEMA_SCRIPTS.filter((file) => file < '004_create_clicks.sql'))`. Con `createTestDatabase([])` la base queda sin tablas, y `applySchemaScripts(db)` las crea después, como el DBA sobre una base en uso.
- Tests de API: levantar `createApp(db, secreto, webDir?)` con `.listen(0, '127.0.0.1')` y pegarle con `fetch` real. El secreto se genera con `randomBytes(32)`. Cerrar el servidor en `afterAll`.
- Tests de service: usar los repositorios reales sobre la base en memoria. Lo que se inyecta para probar casos límite (p. ej. `nextCode` en `createUrlsService` para forzar colisiones) es parte de la API pública del service, no un mock.
- Los usuarios de prueba se crean por la API (`/auth/register`) o con el repositorio, no insertando filas a mano, salvo que el test verifique justo el dato guardado.

## SPA

- Testing Library + `userEvent`: renderizar `<SessionProvider><App /></SessionProvider>` o el componente, e interactuar como el usuario. Buscar por rol, etiqueta o texto visible (`getByRole`, `getByLabelText`); nada de selectores CSS ni `data-testid`.
- La red es el único borde que se simula, con `mockFetch` de `__tests__/fetch-mock.ts`: cada clave es `"MÉTODO ruta"` tal como la pide la SPA. Una petición no declarada hace fallar el test, así que se declaran todas las que el flujo dispara. Para probar una respuesta que llega tarde, el handler devuelve una promesa que el test resuelve cuando quiere.
- `mockFetch` responde por defecto `GET /auth/me` con 401 (no hay sesión) y `POST /auth/logout` con 204; un test que necesite una sesión ya iniciada declara su propio `GET /auth/me`. Como el login aparece después de esa consulta, se busca con `findBy…`, no con `getBy…`.
- Sesión con `authResult(segundos)` (body del login, del registro y de `/auth/me`); datos con las fábricas `ana`, `urlItem`, `overview` y `urlsPage`. Si cambia el contrato de la API, se actualizan las fábricas.
- `setup.ts` desmonta y quita los stubs globales después de cada test; no repetirlo en cada archivo.

## Mocks permitidos

- Red (`fetch` en la SPA), APIs del navegador que jsdom no tiene o que fallan a propósito (`navigator.clipboard`), `console.error` para silenciar un error que el test provoca, y el tiempo con `vi.useFakeTimers` / `vi.setSystemTime`.
- Nunca mockear servicios, repositorios, `session.tsx`, `api.ts` ni componentes propios.
