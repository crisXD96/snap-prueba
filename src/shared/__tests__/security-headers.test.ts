import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.ts';
import { createTestDatabase } from './test-database.ts';

describe('headers de seguridad', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApp(createTestDatabase(), randomBytes(32).toString('hex')).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  it.each(['/health', '/dashboard'])('responde %s con CSP estricta y los headers que evitan sniffing y framing', async (path) => {
    const res = await fetch(`${baseUrl}${path}`);

    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });

  it('no anuncia que el servidor usa Express', async () => {
    const res = await fetch(`${baseUrl}/health`);

    expect(res.headers.get('x-powered-by')).toBeNull();
  });
});
