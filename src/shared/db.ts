import { DatabaseSync } from 'node:sqlite';
import type { StatementSync } from 'node:sqlite';

// Solo abre la conexión: el esquema se aplica desde db-scripts/, no al arrancar.
export function openDatabase(path: string = process.env.DB_PATH ?? 'snap.db'): DatabaseSync {
  return new DatabaseSync(path);
}

// Prepara la sentencia en el primer uso y después la reutiliza. Prepararla al usarla, y no al
// crear el repositorio, deja arrancar la app aunque el DBA todavía no haya creado las tablas;
// si falla, no se guarda y se vuelve a intentar en la siguiente llamada.
export function lazyStatement(db: DatabaseSync, sql: string): () => StatementSync {
  let statement: StatementSync | undefined;
  return () => (statement ??= db.prepare(sql));
}
