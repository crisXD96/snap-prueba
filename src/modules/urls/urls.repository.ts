import type { DatabaseSync } from 'node:sqlite';

export interface UrlRecord {
  code: string;
  url: string;
  // null en las URLs creadas antes de asociarlas a usuarios.
  userId: number | null;
  createdAt: string;
}

interface UrlRow {
  code: string;
  original_url: string;
  user_id: number | null;
  created_at: string;
}

export interface UrlsRepository {
  // Devuelve undefined si el código ya existe, para que quien llama elija otro.
  insert(code: string, url: string, userId: number): UrlRecord | undefined;
  findByCode(code: string): UrlRecord | undefined;
  findAll(): UrlRecord[];
  delete(code: string): void;
}

function toRecord(row: UrlRow): UrlRecord {
  return { code: row.code, url: row.original_url, userId: row.user_id, createdAt: row.created_at };
}

// Las sentencias se preparan en cada llamada para que la app arranque aunque la tabla
// todavía no exista; el error aparece solo al usar el módulo.
export function createUrlsRepository(db: DatabaseSync): UrlsRepository {
  return {
    insert(code, url, userId) {
      const row = db
        .prepare(
          `INSERT INTO urls (code, original_url, user_id) VALUES (?, ?, ?)
           ON CONFLICT (code) DO NOTHING
           RETURNING code, original_url, user_id, created_at`,
        )
        .get(code, url, userId) as UrlRow | undefined;
      return row ? toRecord(row) : undefined;
    },

    findByCode(code) {
      const row = db
        .prepare('SELECT code, original_url, user_id, created_at FROM urls WHERE code = ?')
        .get(code) as UrlRow | undefined;
      return row ? toRecord(row) : undefined;
    },

    findAll() {
      const rows = db
        .prepare('SELECT code, original_url, user_id, created_at FROM urls ORDER BY created_at DESC, rowid DESC')
        .all() as unknown as UrlRow[];
      return rows.map(toRecord);
    },

    delete(code) {
      db.prepare('DELETE FROM urls WHERE code = ?').run(code);
    },
  };
}
