-- Usuarios de Snap para autenticación con password hasheado.
-- La aplica el DBA tras revisión: la aplicación no crea ni modifica el esquema.
CREATE TABLE IF NOT EXISTS users (
  -- AUTOINCREMENT evita reutilizar el id de un usuario borrado que aún figure en un token.
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  -- NOCASE hace que Ana@x.com y ana@x.com cuenten como el mismo email.
  email         TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
