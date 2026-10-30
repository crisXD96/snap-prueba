---
paths:
  - "src/**"
---

# Reglas de diseño

## Backend

- Un módulo nuevo va en `src/modules/<nombre>/` con `<nombre>.routes.ts`, `<nombre>.service.ts` y `<nombre>.repository.ts`, exportando funciones fábrica (`createXRouter`, `createXService`, `createXRepository`). Sin clases de servicio ni contenedor de DI.
- Las dependencias llegan por parámetro: el router recibe `db` y, si tiene rutas protegidas, `requireAuth`. Solo `server.ts` y `shared/db.ts` leen `process.env`; ningún módulo conoce `JWT_SECRET`.
- El router nuevo se monta en `app.ts` antes de `createUrlsRouter` si declara rutas de un solo segmento, para que `GET /:code` no las intercepte, y siempre antes de la SPA estática.
- El service recibe la entrada del body o la query como `unknown`, la valida y lanza errores de dominio (`class XError extends Error {}`) con mensajes en español para el usuario. El router traduce cada error esperado a su código HTTP con `{ error: mensaje }` y relanza los demás.
- El repository solo hace SQL con parámetros `?`, declara cada sentencia con `lazyStatement(db, sql)` de `shared/db.ts` (se prepara en el primer uso, así la app arranca aunque falten tablas) y convierte las filas `snake_case` en records `camelCase`. Nunca `db.prepare` directo en un repository. La lógica de negocio no va aquí.
- TypeScript del backend: imports relativos con extensión `.ts`, `import type` para los tipos (`verbatimModuleSyntax`) y nada que no se pueda borrar al ejecutar (`erasableSyntaxOnly`): sin `enum`, sin `namespace` con valores, sin parameter properties.
- Respuestas JSON: arreglos y objetos en `camelCase`. Nunca devolver campos internos como `passwordHash` o `userId` en endpoints públicos.

## Cambios de contrato

Una ruta, un campo de respuesta o un código de error nuevo o modificado de la API tiene estos consumidores, que se revisan antes de editar:

- `src/web/api.ts` (tipos y cliente) y los componentes que lo usan.
- El proxy de `src/web/vite.config.ts`, si la ruta es nueva.
- `src/web/__tests__/fetch-mock.ts` (fábricas `overview`, `urlItem`, etc.).
- Los tests del módulo en `src/modules/<nombre>/__tests__/`.
- Las secciones "Pantallas" y "Sesión" del `README.md`, si cambia lo que ve el usuario.

## SPA

- Componentes de función en `src/web/components/`, un componente exportado por archivo con nombre en PascalCase. Sin librerías de UI, de estado ni router: proponer una al equipo antes de agregarla.
- Toda llamada HTTP pasa por `api.ts`; los componentes no llaman a `fetch`. Los errores se muestran con el `message` de `ApiError`, que ya trae el texto del backend o uno genérico en español.
- El estado de sesión solo se toca con `useSession()`: `signIn` y `signOut`. Nada de duplicar el token en otro estado.
- Fechas y números solo con `format.ts` (`es-MX`, hora `America/Mexico_City`). Los días del dashboard (`YYYY-MM-DD`) ya vienen en hora local y se formatean con `formatDay`.
- Textos de la interfaz en español, con tuteo ("Inicia sesión", "Copiar enlace").
- Accesibilidad: cada input con `<label>` asociado, botones con texto visible y secciones con nombre accesible (`aria-label` o encabezado). Los tests buscan por rol y por etiqueta, así que esto también los mantiene estables.
- Gráficas: el dibujo lleva `aria-hidden="true"` y los datos van en una tabla con `<caption>` dentro de un `<div className="visually-hidden">`, más un resumen en texto visible (total y valor máximo). Así está `TrendChart`. La clase va en el `div`, nunca en la `<table>`: una tabla ignora `height: 1px` y sus filas alargan la página.

## Estilos

- Todo en `src/web/styles.css`, con clases planas en kebab-case. Sin CSS-in-JS ni atributos `style`, ni siquiera para valores calculados: una CSP estricta los bloquea. Un tamaño calculado va como atributo SVG, como las barras de `TrendChart`.
- Colores solo con las variables de `:root` (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--accent`, `--accent-text`, `--danger`, `--danger-text`, `--notice-bg`). Un color nuevo se define en `:root` y también en el bloque `prefers-color-scheme: dark`.
- El texto sobre un fondo de color usa su variable pareja (`--accent-text` sobre `--accent`, `--danger-text` sobre `--danger`), nunca un color fijo. `src/web/__tests__/styles.test.ts` verifica el contraste AA (4.5:1) en los dos temas: una combinación nueva de texto y fondo se agrega a su lista `PAIRS`.
- El foco de teclado lo marca la regla `:focus-visible`; no quitar el `outline` de ningún elemento.
- Diseño adaptable con los cortes existentes: `max-width: 900px` (tablet vertical) y `max-width: 600px` (celular). En esos anchos las tablas pasan a tarjetas, sin scroll horizontal.
