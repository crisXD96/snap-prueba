-- Tabla de URLs acortadas de Snap.
-- La aplica el DBA tras revisión: la aplicación no crea ni modifica el esquema.
CREATE TABLE IF NOT EXISTS urls (
  code         TEXT PRIMARY KEY CHECK (length(code) = 7),
  original_url TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
