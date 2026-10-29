-- Asocia cada URL al usuario que la creó. Requiere 001_create_urls.sql y 002_create_users.sql.
-- La aplica el DBA tras revisión: la aplicación no crea ni modifica el esquema.
-- No es repetible: ALTER TABLE falla si la columna ya existe.

-- SQLite solo permite agregar una columna con REFERENCES si admite NULL. Las URLs creadas
-- antes de este script quedan con user_id NULL: no tienen dueño y nadie puede borrarlas.
ALTER TABLE urls ADD COLUMN user_id INTEGER REFERENCES users (id);

-- Evita recorrer toda la tabla al comprobar la clave foránea o buscar las URLs de un usuario.
CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls (user_id);
