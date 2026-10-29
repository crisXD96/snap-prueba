import { DatabaseSync } from 'node:sqlite';

// Solo abre la conexión: el esquema se aplica desde db-scripts/, no al arrancar.
export function openDatabase(path: string = process.env.DB_PATH ?? 'snap.db'): DatabaseSync {
  return new DatabaseSync(path);
}
