-- Cada redirección escribe un click: con WAL esa escritura no espera a las lecturas del
-- dashboard y sincroniza menos con el disco.
-- La aplica el DBA tras revisión, con la app detenida: queda guardado en el archivo de la base.
-- Desde entonces la base son tres archivos (snap.db, snap.db-wal y snap.db-shm): copiar solo
-- snap.db no es un respaldo completo; para respaldar, usar .backup de la CLI de sqlite3.
PRAGMA journal_mode = WAL;
