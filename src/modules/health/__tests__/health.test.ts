import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.ts';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createApp(new DatabaseSync(':memory:'), randomBytes(32).toString('hex')).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  server.close();
  await once(server, 'close');
});

describe('GET /health', () => {
  it('responde 200 con status ok', async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
