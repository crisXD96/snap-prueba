import type { DatabaseSync } from 'node:sqlite';

export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  name: string;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export interface UsersRepository {
  // Devuelve undefined si el email ya existe, para que quien llama decida el error.
  insert(user: NewUser): UserRecord | undefined;
  findByEmail(email: string): UserRecord | undefined;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    createdAt: row.created_at,
  };
}

// Igual que en urls: se prepara en cada llamada para no exigir la tabla al arrancar.
export function createUsersRepository(db: DatabaseSync): UsersRepository {
  return {
    insert({ email, passwordHash, name }) {
      const row = db
        .prepare(
          `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
           ON CONFLICT (email) DO NOTHING
           RETURNING id, email, password_hash, name, created_at`,
        )
        .get(email, passwordHash, name) as UserRow | undefined;
      return row ? toRecord(row) : undefined;
    },

    findByEmail(email) {
      const row = db
        .prepare('SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?')
        .get(email) as UserRow | undefined;
      return row ? toRecord(row) : undefined;
    },
  };
}
