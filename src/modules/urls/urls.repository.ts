import type { DatabaseSync } from 'node:sqlite';
import { lazyStatement } from '../../shared/db.ts';

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
  delete(code: string): void;
}

function toRecord(row: UrlRow): UrlRecord {
  return { code: row.code, url: row.original_url, userId: row.user_id, createdAt: row.created_at };
}

export function createUrlsRepository(db: DatabaseSync): UrlsRepository {
  const insert = lazyStatement(
    db,
    `INSERT INTO urls (code, original_url, user_id) VALUES (?, ?, ?)
     ON CONFLICT (code) DO NOTHING
     RETURNING code, original_url, user_id, created_at`,
  );
  const findByCode = lazyStatement(db, 'SELECT code, original_url, user_id, created_at FROM urls WHERE code = ?');
  const remove = lazyStatement(db, 'DELETE FROM urls WHERE code = ?');

  return {
    insert(code, url, userId) {
      const row = insert().get(code, url, userId) as UrlRow | undefined;
      return row ? toRecord(row) : undefined;
    },

    findByCode(code) {
      const row = findByCode().get(code) as UrlRow | undefined;
      return row ? toRecord(row) : undefined;
    },

    delete(code) {
      remove().run(code);
    },
  };
}
