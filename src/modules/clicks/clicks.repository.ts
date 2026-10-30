import type { DatabaseSync } from 'node:sqlite';
import { lazyStatement } from '../../shared/db.ts';

export interface NewClick {
  code: string;
  referrer: string | null;
  userAgent: string | null;
}

export interface ClicksRepository {
  record(click: NewClick): void;
}

export function createClicksRepository(db: DatabaseSync): ClicksRepository {
  const insert = lazyStatement(db, 'INSERT INTO clicks (code, referrer, user_agent) VALUES (?, ?, ?)');

  return {
    record({ code, referrer, userAgent }) {
      insert().run(code, referrer, userAgent);
    },
  };
}
