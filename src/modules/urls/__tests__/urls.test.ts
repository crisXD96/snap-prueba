import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../app.ts';
import { createTestDatabase, SCHEMA_SCRIPTS } from '../../../shared/__tests__/test-database.ts';
import { createUsersRepository } from '../../auth/auth.repository.ts';
import { createClicksRepository } from '../../clicks/clicks.repository.ts';
import { createUrlsRepository } from '../urls.repository.ts';
import { CodeGenerationError, createUrlsService, NotUrlOwnerError, UrlNotFoundError } from '../urls.service.ts';

interface ClickRow {
  referrer: string | null;
  userAgent: string | null;
  clickedAt: string;
}

function clicksOf(db: DatabaseSync, code: string): ClickRow[] {
  return db
    .prepare('SELECT referrer, user_agent AS userAgent, clicked_at AS clickedAt FROM clicks WHERE code = ?')
    .all(code) as unknown as ClickRow[];
}

const noVisitHeaders = { referrer: undefined, userAgent: undefined };

describe('API de urls', () => {
  let db: DatabaseSync;
  let server: Server;
  let baseUrl: string;
  let anaToken: string;
  let beaToken: string;

  async function registerUser(alias: string): Promise<string> {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${alias}@example.com`, password: 'contraseña-segura-123', name: alias }),
    });
    return ((await res.json()) as { token: string }).token;
  }

  beforeAll(async () => {
    db = createTestDatabase();
    server = createApp(db, randomBytes(32).toString('hex')).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    anaToken = await registerUser('ana');
    beaToken = await registerUser('bea');
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  // null es "sin token": undefined activaría el valor por defecto de los parámetros.
  function authHeader(token: string | null): Record<string, string> {
    return token === null ? {} : { authorization: `Bearer ${token}` };
  }

  function shorten(body: unknown, token: string | null = anaToken): Promise<Response> {
    return fetch(`${baseUrl}/urls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeader(token) },
      body: JSON.stringify(body),
    });
  }

  function remove(code: string, token: string | null = anaToken): Promise<Response> {
    return fetch(`${baseUrl}/urls/${code}`, { method: 'DELETE', headers: authHeader(token) });
  }

  async function createShortUrl(url: string, token?: string): Promise<{ code: string; url: string }> {
    return (await (await shorten({ url }, token)).json()) as { code: string; url: string };
  }

  describe('POST /urls', () => {
    it('crea un código corto de 7 caracteres para una url http', async () => {
      const res = await shorten({ url: 'https://example.com/un/camino/largo?x=1' });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({
        code: expect.stringMatching(/^[0-9A-Za-z]{7}$/),
        url: 'https://example.com/un/camino/largo?x=1',
      });
    });

    it('responde 401 y no crea nada cuando no hay token', async () => {
      const res = await shorten({ url: 'https://example.com/sin-token' }, null);

      expect(res.status).toBe(401);
      const list = (await (await fetch(`${baseUrl}/urls`)).json()) as { url: string }[];
      expect(list.map((item) => item.url)).not.toContain('https://example.com/sin-token');
    });

    it('rechaza con 400 una url que no es http ni https', async () => {
      const res = await shorten({ url: 'javascript:alert(1)' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'La url debe ser http o https' });
    });

    it('agrega https:// cuando la url no trae esquema y redirige a esa url', async () => {
      const res = await shorten({ url: 'lolesports.com/es-ES/tournament/1' });

      expect(res.status).toBe(201);
      const { code, url } = (await res.json()) as { code: string; url: string };
      expect(url).toBe('https://lolesports.com/es-ES/tournament/1');
      const redirect = await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });
      expect(redirect.headers.get('location')).toBe('https://lolesports.com/es-ES/tournament/1');
    });

    it('agrega https:// a un dominio con puerto sin confundir el puerto con un esquema', async () => {
      const res = await shorten({ url: 'example.com:8080/panel' });

      expect(res.status).toBe(201);
      expect(((await res.json()) as { url: string }).url).toBe('https://example.com:8080/panel');
    });

    it('conserva http:// cuando la url lo trae explícito', async () => {
      const res = await shorten({ url: 'http://example.com/sin-tls' });

      expect(res.status).toBe(201);
      expect(((await res.json()) as { url: string }).url).toBe('http://example.com/sin-tls');
    });

    it('rechaza con 400 un texto sin esquema que no tiene forma de dominio', async () => {
      const res = await shorten({ url: 'hola' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'La url no es válida' });
    });

    it('rechaza con 400 un esquema que no es http ni https', async () => {
      const res = await shorten({ url: 'ftp://example.com/archivo' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'La url debe ser http o https' });
    });

    it('rechaza con 400 una petición sin url', async () => {
      const res = await shorten({});

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'El campo url es obligatorio' });
    });
  });

  describe('rutas públicas', () => {
    it('redirige con 302 a la url original sin pedir token', async () => {
      const { code } = await createShortUrl('https://example.com/destino');

      const res = await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://example.com/destino');
    });

    it('responde 404 cuando el código no existe', async () => {
      const res = await fetch(`${baseUrl}/zzzzzzz`, { redirect: 'manual' });

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Código no encontrado' });
    });

    it('lista sin pedir token las urls de todos, de la más reciente a la más antigua y sin exponer al dueño', async () => {
      const primera = await createShortUrl('https://example.com/primera', anaToken);
      const segunda = await createShortUrl('https://example.com/segunda', beaToken);

      const res = await fetch(`${baseUrl}/urls`);

      expect(res.status).toBe(200);
      const list = (await res.json()) as { code: string; url: string; createdAt: string }[];
      const codes = list.map((item) => item.code);
      expect(codes.indexOf(segunda.code)).toBeLessThan(codes.indexOf(primera.code));
      expect(list).toContainEqual({ code: primera.code, url: 'https://example.com/primera', createdAt: expect.any(String) });
    });

    it('no captura /health con la ruta de códigos', async () => {
      const res = await fetch(`${baseUrl}/health`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok' });
    });
  });

  describe('DELETE /urls/:code', () => {
    it('borra la url cuando la pide su dueño y deja de redirigir', async () => {
      const { code } = await createShortUrl('https://example.com/borrar', anaToken);

      const res = await remove(code, anaToken);

      expect(res.status).toBe(204);
      expect((await fetch(`${baseUrl}/${code}`, { redirect: 'manual' })).status).toBe(404);
    });

    it('responde 403 y no borra cuando la url es de otro usuario', async () => {
      const { code } = await createShortUrl('https://example.com/ajena', anaToken);

      const res = await remove(code, beaToken);

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'La url pertenece a otro usuario' });
      expect((await fetch(`${baseUrl}/${code}`, { redirect: 'manual' })).status).toBe(302);
    });

    it('responde 401 y no borra cuando no hay token', async () => {
      const { code } = await createShortUrl('https://example.com/protegida', anaToken);

      const res = await remove(code, null);

      expect(res.status).toBe(401);
      expect((await fetch(`${baseUrl}/${code}`, { redirect: 'manual' })).status).toBe(302);
    });

    it('responde 404 cuando el código no existe', async () => {
      const res = await remove('zzzzzzz', anaToken);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Código no encontrado' });
    });
  });

  describe('registro de clicks', () => {
    it('registra un click con fecha, solo el origen del referrer y el user agent al redirigir', async () => {
      const { code } = await createShortUrl('https://example.com/con-click');

      const res = await fetch(`${baseUrl}/${code}`, {
        redirect: 'manual',
        headers: { referer: 'https://noticias.example.org/nota/1?token=secreto', 'user-agent': 'PruebaSnap/1.0' },
      });

      expect(res.status).toBe(302);
      expect(clicksOf(db, code)).toEqual([
        { referrer: 'https://noticias.example.org', userAgent: 'PruebaSnap/1.0', clickedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
      ]);
    });

    it('cuenta cada visita como un click aparte', async () => {
      const { code } = await createShortUrl('https://example.com/varias-visitas');

      await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });
      await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });

      expect(clicksOf(db, code)).toHaveLength(2);
    });

    it('no registra ningún click cuando el código no existe', async () => {
      const before = clicksOf(db, 'yyyyyyy').length;

      const res = await fetch(`${baseUrl}/yyyyyyy`, { redirect: 'manual' });

      expect(res.status).toBe(404);
      expect(clicksOf(db, 'yyyyyyy')).toHaveLength(before);
    });

    it('borrar una url borra también sus clicks', async () => {
      const { code } = await createShortUrl('https://example.com/borrar-con-clicks', anaToken);
      await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });

      await remove(code, anaToken);

      expect(clicksOf(db, code)).toEqual([]);
    });
  });
});

describe('servicio de urls', () => {
  // La clave foránea exige que el dueño exista en users.
  function setup(nextCode?: () => string): { service: ReturnType<typeof createUrlsService>; db: DatabaseSync; userId: number } {
    const db = createTestDatabase();
    const user = createUsersRepository(db).insert({ email: 'ana@example.com', passwordHash: 'hash', name: 'Ana' });
    if (!user) throw new Error('No se pudo crear el usuario de prueba');
    return {
      service: createUrlsService(createUrlsRepository(db), createClicksRepository(db), nextCode),
      db,
      userId: user.id,
    };
  }

  function urlOf(db: DatabaseSync, code: string): string | undefined {
    return createUrlsRepository(db).findByCode(code)?.url;
  }

  it('guarda la url asociada al usuario que la creó', () => {
    const { service, db, userId } = setup();

    const { code } = service.shorten('https://example.com/mia', userId);

    expect(createUrlsRepository(db).findByCode(code)?.userId).toBe(userId);
  });

  it('reintenta con otro código cuando el generado ya existe', () => {
    const codes = ['aaaaaaa', 'aaaaaaa', 'bbbbbbb'];
    const { service, db, userId } = setup(() => codes.shift() ?? '');

    service.shorten('https://example.com/1', userId);
    const record = service.shorten('https://example.com/2', userId);

    expect(record.code).toBe('bbbbbbb');
    expect(urlOf(db, 'aaaaaaa')).toBe('https://example.com/1');
  });

  it('falla cuando todos los intentos de código colisionan', () => {
    const { service, userId } = setup(() => 'aaaaaaa');
    service.shorten('https://example.com/1', userId);

    expect(() => service.shorten('https://example.com/2', userId)).toThrow(CodeGenerationError);
  });

  it('no deja borrar una url sin dueño a ningún usuario', () => {
    const { service, db, userId } = setup();
    db.prepare("INSERT INTO urls (code, original_url) VALUES ('antigua', 'https://example.com/antigua')").run();

    expect(() => service.remove('antigua', userId)).toThrow(NotUrlOwnerError);
    expect(urlOf(db, 'antigua')).toBe('https://example.com/antigua');
  });

  it('falla al borrar un código que no existe', () => {
    const { service, userId } = setup();

    expect(() => service.remove('zzzzzzz', userId)).toThrow(UrlNotFoundError);
  });

  it('recorta el user agent a 512 caracteres y guarda null sin referrer web', () => {
    const { service, db, userId } = setup();
    const { code } = service.shorten('https://example.com/agente-largo', userId);

    service.resolve(code, { referrer: 'android-app://com.slack/', userAgent: 'x'.repeat(600) });

    const [click] = clicksOf(db, code);
    expect(click?.userAgent).toHaveLength(512);
    expect(click?.referrer).toBeNull();
  });

  it('redirige aunque no se pueda registrar el click', () => {
    // Sin el script de clicks el INSERT falla, como cuando la base está bloqueada.
    const db = createTestDatabase(SCHEMA_SCRIPTS.filter((file) => file < '004_create_clicks.sql'));
    db.prepare("INSERT INTO urls (code, original_url) VALUES ('sinclik', 'https://example.com/sin-clicks')").run();
    const service = createUrlsService(createUrlsRepository(db), createClicksRepository(db));
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(service.resolve('sinclik', noVisitHeaders)).toBe('https://example.com/sin-clicks');
      expect(logError).toHaveBeenCalledWith('No se pudo registrar el click', expect.any(Error));
    } finally {
      logError.mockRestore();
    }
  });
});
