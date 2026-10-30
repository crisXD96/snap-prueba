import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.ts';
import { createTestDatabase } from '../../../shared/__tests__/test-database.ts';

describe('GET /health', () => {
  let server: Server | undefined;

  async function start(db: DatabaseSync): Promise<string> {
    server = createApp(db, randomBytes(32).toString('hex')).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  afterEach(async () => {
    server?.close();
    if (server) await once(server, 'close');
    server = undefined;
  });

  // Sin scripts: el servidor está sano aunque el DBA todavía no haya creado las tablas.
  it('responde 200 con status ok cuando la base responde', async () => {
    const baseUrl = await start(createTestDatabase([]));

    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('responde 503 cuando no se puede consultar la base', async () => {
    const db = createTestDatabase([]);
    const baseUrl = await start(db);
    db.close();
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await fetch(`${baseUrl}/health`);

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ status: 'error' });
      expect(logError).toHaveBeenCalledWith('La base no responde', expect.any(Error));
    } finally {
      logError.mockRestore();
    }
  });
});
