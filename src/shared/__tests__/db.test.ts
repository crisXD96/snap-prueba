import { describe, expect, it } from 'vitest';
import { lazyStatement } from '../db.ts';
import { applySchemaScripts, createTestDatabase } from './test-database.ts';

describe('sentencias preparadas una sola vez', () => {
  it('prepara la sentencia en el primer uso y después reutiliza la misma', () => {
    const statement = lazyStatement(createTestDatabase(), 'SELECT COUNT(*) AS total FROM urls');

    expect(statement()).toBe(statement());
    expect(statement().get()).toEqual({ total: 0 });
  });

  it('falla al usarla si la tabla no existe y funciona en cuanto el DBA la crea, sin reiniciar', () => {
    const db = createTestDatabase([]);
    const statement = lazyStatement(db, 'SELECT COUNT(*) AS total FROM urls');
    expect(() => statement()).toThrow(/no such table: urls/);

    applySchemaScripts(db);

    expect(statement().get()).toEqual({ total: 0 });
  });
});
