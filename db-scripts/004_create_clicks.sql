-- Un registro por cada redirección servida, para las analíticas de Snap. Requiere 001_create_urls.sql.
-- La aplica el DBA tras revisión: la aplicación no crea ni modifica el esquema.
CREATE TABLE IF NOT EXISTS clicks (
  id         INTEGER PRIMARY KEY,
  -- Borrar una URL borra sus clicks, pero solo con PRAGMA foreign_keys = ON: la app lo
  -- tiene activo; la CLI de sqlite3 no, y desde ahí los clicks quedarían huérfanos.
  code       TEXT NOT NULL REFERENCES urls (code) ON DELETE CASCADE,
  clicked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- Solo el origen (https://sitio.com): la ruta y la query pueden traer datos personales.
  referrer   TEXT,
  user_agent TEXT
);

-- Sirve al borrado en cascada y a las consultas de clicks por URL en el tiempo.
CREATE INDEX IF NOT EXISTS idx_clicks_code_clicked_at ON clicks (code, clicked_at);
