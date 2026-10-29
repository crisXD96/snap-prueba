-- Lista las URLs de un usuario de la más reciente a la más antigua sin ordenarlas en cada
-- página del dashboard. Requiere 003_add_user_to_urls.sql.
-- La aplica el DBA tras revisión: la aplicación no crea ni modifica el esquema.
CREATE INDEX IF NOT EXISTS idx_urls_user_id_created_at ON urls (user_id, created_at);

-- El índice nuevo también sirve para buscar por user_id y comprobar la clave foránea:
-- mantener los dos solo encarece cada INSERT.
DROP INDEX IF EXISTS idx_urls_user_id;
