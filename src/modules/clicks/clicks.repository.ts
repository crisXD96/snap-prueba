import type { DatabaseSync } from 'node:sqlite';

export interface NewClick {
  code: string;
  referrer: string | null;
  userAgent: string | null;
}

export interface ClicksRepository {
  record(click: NewClick): void;
}

// Igual que en urls: se prepara en cada llamada para no exigir la tabla al arrancar.
export function createClicksRepository(db: DatabaseSync): ClicksRepository {
  return {
    record({ code, referrer, userAgent }) {
      db.prepare('INSERT INTO clicks (code, referrer, user_agent) VALUES (?, ?, ?)').run(code, referrer, userAgent);
    },
  };
}
