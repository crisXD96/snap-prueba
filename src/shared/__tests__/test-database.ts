import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SCRIPTS_DIR = new URL('../../../db-scripts/', import.meta.url);

// Todos los scripts que revisa el DBA, en el orden en que se aplican: un script nuevo entra solo.
export const SCHEMA_SCRIPTS: readonly string[] = readdirSync(SCRIPTS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort();

// Como los aplica el DBA sobre una base que ya está en uso.
export function applySchemaScripts(db: DatabaseSync, scripts: readonly string[] = SCHEMA_SCRIPTS): void {
  for (const file of scripts) {
    db.exec(readFileSync(new URL(file, SCRIPTS_DIR), 'utf8'));
  }
}

// Base en memoria con el esquema real. Recibir menos scripts sirve para probar una base a medio migrar.
export function createTestDatabase(scripts: readonly string[] = SCHEMA_SCRIPTS): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  applySchemaScripts(db, scripts);
  return db;
}
