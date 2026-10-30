import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.ts';
import { createTestDatabase } from './test-database.ts';

const UNEXPECTED_ERROR = 'Ocurrió un error inesperado. Intenta de nuevo.';

describe('errores no controlados de la API', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Sin scripts no existe la tabla users: registrar falla como falla una base a medio migrar.
    server = createApp(createTestDatabase([]), randomBytes(32).toString('hex')).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  it('responde 500 en JSON con un mensaje genérico y sin el stack cuando una ruta falla', async () => {
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'ana@example.com', password: 'contraseña-segura-123', name: 'Ana' }),
      });
      const body = await res.text();

      expect(res.status).toBe(500);
      expect(res.headers.get('content-type')).toMatch(/application\/json/);
      expect(JSON.parse(body)).toEqual({ error: UNEXPECTED_ERROR });
      expect(body).not.toMatch(/no such table|\.ts:\d+/);
      expect(logError).toHaveBeenCalledWith('Error no controlado', expect.any(Error));
    } finally {
      logError.mockRestore();
    }
  });

  it('responde 400 en JSON cuando el body no es JSON válido', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email": ',
    });

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: 'La petición no es válida' });
  });
});
