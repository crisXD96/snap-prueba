import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.ts';
import { createTestDatabase } from '../../../shared/__tests__/test-database.ts';

async function listen(webDir?: string): Promise<{ server: Server; baseUrl: string }> {
  const server = createApp(createTestDatabase(), randomBytes(32).toString('hex'), webDir).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function close(server: Server): Promise<void> {
  server.close();
  await once(server, 'close');
}

describe('SPA servida por Express', () => {
  let webDir: string;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    webDir = mkdtempSync(join(tmpdir(), 'snap-web-'));
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>Snap SPA</title>');
    writeFileSync(join(webDir, 'app.js'), 'console.log("snap")');
    // Un archivo con forma de código corto: la redirección debe ganarle.
    writeFileSync(join(webDir, 'aB3xK9z'), 'no debería servirse');
    ({ server, baseUrl } = await listen(webDir));
  });

  afterAll(async () => {
    await close(server);
    rmSync(webDir, { recursive: true, force: true });
  });

  it('sirve el index.html de la SPA en la raíz', async () => {
    const res = await fetch(`${baseUrl}/`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toContain('Snap SPA');
  });

  it('sirve los recursos estáticos del build', async () => {
    const res = await fetch(`${baseUrl}/app.js`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/javascript/);
  });

  it('la API conserva la prioridad sobre los archivos estáticos', async () => {
    const health = await fetch(`${baseUrl}/health`);
    const code = await fetch(`${baseUrl}/aB3xK9z`, { redirect: 'manual' });

    expect(await health.json()).toEqual({ status: 'ok' });
    expect(code.status).toBe(404);
    expect(await code.json()).toEqual({ error: 'Código no encontrado' });
  });

  it('una ruta que no existe sigue respondiendo 404', async () => {
    const res = await fetch(`${baseUrl}/no-existe.css`);

    expect(res.status).toBe(404);
  });
});

describe('sin carpeta de la SPA', () => {
  it('no sirve nada en la raíz', async () => {
    const { server, baseUrl } = await listen();

    const res = await fetch(`${baseUrl}/`);
    await close(server);

    expect(res.status).toBe(404);
  });
});
