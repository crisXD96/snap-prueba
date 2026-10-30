import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.ts';
import { createTestDatabase } from '../../../shared/__tests__/test-database.ts';
import { createAuthMiddleware } from '../auth.middleware.ts';
import { createUsersRepository } from '../auth.repository.ts';
import type { UsersRepository } from '../auth.repository.ts';
import { createAuthService, EmailAlreadyRegisteredError, InvalidCredentialsError } from '../auth.service.ts';
import type { AuthService } from '../auth.service.ts';

// Secreto aleatorio por ejecución: los tests no dependen de ninguna clave real.
const jwtSecret = randomBytes(32).toString('hex');

const ana = { email: 'ana@example.com', password: 'contraseña-segura-123', name: 'Ana' };

function decode(token: string): JwtPayload {
  return jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
}

describe('servicio de autenticación', () => {
  let repository: UsersRepository;
  let service: AuthService;

  beforeEach(() => {
    repository = createUsersRepository(createTestDatabase());
    service = createAuthService(repository, jwtSecret);
  });

  it('registra al usuario con el password hasheado y devuelve un JWT que expira en 24 horas', async () => {
    const { token } = await service.register({ ...ana, email: 'Ana@Example.COM' });

    const user = repository.findByEmail('ana@example.com');
    expect(user).toMatchObject({ email: 'ana@example.com', name: 'Ana' });
    expect(user?.passwordHash).not.toBe(ana.password);
    expect(await bcrypt.compare(ana.password, user?.passwordHash ?? '')).toBe(true);

    const payload = decode(token);
    expect(payload.sub).toBe(String(user?.id));
    expect(payload.email).toBe('ana@example.com');
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(24 * 60 * 60);
  });

  it('rechaza registrar un email ya existente aunque cambien las mayúsculas', async () => {
    await service.register(ana);

    await expect(service.register({ ...ana, email: 'ANA@example.com', name: 'Otra Ana' })).rejects.toThrow(
      EmailAlreadyRegisteredError,
    );
  });

  it('inicia sesión con credenciales correctas y devuelve un JWT del usuario', async () => {
    await service.register(ana);

    const { token } = await service.login(ana.email, ana.password);

    const payload = decode(token);
    expect(payload.sub).toBe(String(repository.findByEmail(ana.email)?.id));
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(24 * 60 * 60);
  });

  it('rechaza el login con password incorrecto', async () => {
    await service.register(ana);

    await expect(service.login(ana.email, 'otra-contraseña')).rejects.toThrow(InvalidCredentialsError);
  });

  it('rechaza el login con un email que no está registrado', async () => {
    await expect(service.login('nadie@example.com', ana.password)).rejects.toThrow(InvalidCredentialsError);
  });

  it('inicia sesión aunque el email venga en mayúsculas', async () => {
    await service.register(ana);

    const { token } = await service.login('ANA@EXAMPLE.COM', ana.password);

    expect(decode(token).email).toBe('ana@example.com');
  });
});

describe('API de autenticación', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = createApp(createTestDatabase(), jwtSecret).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // Cada test usa su propio email porque todos comparten la misma base.
  function newUser(alias: string): { email: string; password: string; name: string } {
    return { email: `${alias}@example.com`, password: 'contraseña-segura-123', name: alias };
  }

  describe('POST /auth/register', () => {
    it('responde 201 con el usuario sin su hash y un token válido', async () => {
      const res = await post('/auth/register', newUser('registro-ok'));

      expect(res.status).toBe(201);
      const body = (await res.json()) as { user: Record<string, unknown>; token: string };
      expect(body.user).toEqual({
        id: expect.any(Number),
        email: 'registro-ok@example.com',
        name: 'registro-ok',
        createdAt: expect.any(String),
      });
      expect(decode(body.token).sub).toBe(String(body.user.id));
    });

    it('responde 400 cuando el email no es válido', async () => {
      const res = await post('/auth/register', { ...newUser('x'), email: 'no-es-un-email' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'El email no es válido' });
    });

    it('responde 400 cuando el password tiene menos de 8 caracteres', async () => {
      const res = await post('/auth/register', { ...newUser('corto'), password: '1234567' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'El password debe tener al menos 8 caracteres' });
    });

    it('responde 400 cuando el password supera los 72 bytes que admite bcrypt', async () => {
      const res = await post('/auth/register', { ...newUser('largo'), password: 'a'.repeat(73) });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'El password no puede superar 72 bytes' });
    });

    it('responde 400 cuando falta el nombre', async () => {
      const res = await post('/auth/register', { ...newUser('sin-nombre'), name: '   ' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'El nombre es obligatorio' });
    });

    it('responde 409 cuando el email ya está registrado', async () => {
      await post('/auth/register', newUser('repetido'));

      const res = await post('/auth/register', { ...newUser('repetido'), email: 'REPETIDO@example.com' });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'El email ya está registrado' });
    });
  });

  describe('POST /auth/login', () => {
    it('responde 200 con el usuario y un token válido', async () => {
      const user = newUser('login-ok');
      await post('/auth/register', user);

      const res = await post('/auth/login', { email: 'LOGIN-OK@example.com', password: user.password });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { user: Record<string, unknown>; token: string };
      expect(body.user).toMatchObject({ email: 'login-ok@example.com', name: 'login-ok' });
      expect(body.user).not.toHaveProperty('passwordHash');
      expect(decode(body.token).sub).toBe(String(body.user.id));
    });

    it('responde 401 cuando el password es incorrecto', async () => {
      const user = newUser('login-mal');
      await post('/auth/register', user);

      const res = await post('/auth/login', { email: user.email, password: 'otra-contraseña' });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Email o password incorrectos' });
    });

    it('responde 401 con el mismo mensaje cuando el email no existe', async () => {
      const res = await post('/auth/login', { email: 'nadie@example.com', password: 'contraseña-segura-123' });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Email o password incorrectos' });
    });

    it('responde 400 cuando faltan email o password', async () => {
      const res = await post('/auth/login', { email: 'ana@example.com' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Email y password son obligatorios' });
    });

    it('responde 429 con Retry-After después de 5 passwords incorrectos, aunque el sexto sea correcto', async () => {
      const user = newUser('login-bloqueado');
      await post('/auth/register', user);
      for (let i = 0; i < 5; i++) {
        expect((await post('/auth/login', { email: user.email, password: 'incorrecto-123' })).status).toBe(401);
      }

      const res = await post('/auth/login', { email: user.email, password: user.password });

      expect(res.status).toBe(429);
      expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(await res.json()).toEqual({ error: expect.stringMatching(/^Demasiados intentos fallidos/) });
    });

    it('cuenta los intentos sin importar mayúsculas en el email', async () => {
      const user = newUser('login-mayusculas');
      await post('/auth/register', user);
      for (let i = 0; i < 5; i++) {
        await post('/auth/login', { email: i % 2 ? user.email : user.email.toUpperCase(), password: 'incorrecto-123' });
      }

      expect((await post('/auth/login', { email: user.email, password: user.password })).status).toBe(429);
    });

    it('un login correcto reinicia el conteo de intentos fallidos', async () => {
      const user = newUser('login-reinicia');
      await post('/auth/register', user);
      for (let i = 0; i < 4; i++) await post('/auth/login', { email: user.email, password: 'incorrecto-123' });
      expect((await post('/auth/login', { email: user.email, password: user.password })).status).toBe(200);

      for (let i = 0; i < 4; i++) await post('/auth/login', { email: user.email, password: 'incorrecto-123' });

      expect((await post('/auth/login', { email: user.email, password: user.password })).status).toBe(200);
    });

    it('no cuenta como intento fallido un login sin email o password', async () => {
      const user = newUser('login-validacion');
      await post('/auth/register', user);
      for (let i = 0; i < 6; i++) await post('/auth/login', { email: user.email });

      expect((await post('/auth/login', { email: user.email, password: user.password })).status).toBe(200);
    });
  });

  describe('sesión en cookie', () => {
    // El valor de Set-Cookie de la sesión, o undefined si la respuesta no la trae.
    function sessionCookie(res: Response): string | undefined {
      return res.headers.getSetCookie().find((cookie) => cookie.startsWith('snap_session='));
    }

    function cookieHeader(setCookie: string | undefined): string {
      return setCookie?.split(';')[0] ?? '';
    }

    async function loginAs(alias: string): Promise<Response> {
      const user = newUser(alias);
      await post('/auth/register', user);
      return post('/auth/login', { email: user.email, password: user.password });
    }

    it.each(['/auth/login', '/auth/register'])(
      'POST %s deja la sesión en una cookie HttpOnly, Secure y SameSite=Strict que dura 24 horas',
      async (path) => {
        const user = newUser(`cookie-${path.split('/').pop()}`);
        if (path === '/auth/login') await post('/auth/register', user);

        const res = await post(path, path === '/auth/login' ? { email: user.email, password: user.password } : user);

        const cookie = sessionCookie(res) ?? '';
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/Secure/i);
        expect(cookie).toMatch(/SameSite=Strict/i);
        expect(cookie).toMatch(/Path=\//);
        expect(Number(/Max-Age=(\d+)/i.exec(cookie)?.[1])).toBeGreaterThan(24 * 60 * 60 - 10);
      },
    );

    it('el login devuelve en el body cuándo expira la sesión', async () => {
      const res = await loginAs('expira');

      const { expiresAt, token } = (await res.json()) as { expiresAt: string; token: string };
      expect(Date.parse(expiresAt)).toBe((decode(token).exp ?? 0) * 1000);
    });

    it('rechaza con 403 un login que viene de otro origen y no deja cookie', async () => {
      const user = newUser('login-ajeno');
      await post('/auth/register', user);

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://sitio-malicioso.example' },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });

      expect(res.status).toBe(403);
      expect(sessionCookie(res)).toBeUndefined();
    });

    it('un login fallido no deja cookie de sesión', async () => {
      const user = newUser('sin-cookie');
      await post('/auth/register', user);

      const res = await post('/auth/login', { email: user.email, password: 'incorrecto-123' });

      expect(sessionCookie(res)).toBeUndefined();
    });

    it('GET /auth/me con la cookie responde 200 con el usuario y la expiración, sin el hash', async () => {
      const login = await loginAs('me-ok');
      const { expiresAt } = (await login.json()) as { expiresAt: string };

      const res = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: cookieHeader(sessionCookie(login)) } });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        user: { id: expect.any(Number), email: 'me-ok@example.com', name: 'me-ok', createdAt: expect.any(String) },
        expiresAt,
      });
    });

    it('GET /auth/me sin cookie responde 401', async () => {
      const res = await fetch(`${baseUrl}/auth/me`);

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'Token requerido' });
    });

    it('GET /auth/me con una cookie que no firmó el servidor responde 401', async () => {
      const res = await fetch(`${baseUrl}/auth/me`, { headers: { cookie: 'snap_session=esto.no-es.un-jwt' } });

      expect(res.status).toBe(401);
    });

    it('POST /auth/logout responde 204 y borra la cookie de sesión', async () => {
      const res = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });

      expect(res.status).toBe(204);
      const cookie = sessionCookie(res) ?? '';
      expect(cookie).toMatch(/^snap_session=;/);
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('con la cookie se puede usar la API protegida sin header Authorization', async () => {
      const login = await loginAs('cookie-api');

      const res = await fetch(`${baseUrl}/urls`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookieHeader(sessionCookie(login)), origin: baseUrl },
        body: JSON.stringify({ url: 'https://example.com/con-cookie' }),
      });

      expect(res.status).toBe(201);
    });
  });
});

describe('middleware de autenticación', () => {
  let server: Server;
  let baseUrl: string;
  let validToken: string;
  let userId: number;

  beforeAll(async () => {
    const service = createAuthService(createUsersRepository(createTestDatabase()), jwtSecret);
    const result = await service.register(ana);
    validToken = result.token;
    userId = result.user.id;

    // Ruta mínima que solo responde lo que el middleware dejó en la request.
    const app = express();
    app.get('/protegida', createAuthMiddleware(jwtSecret), (req, res) => {
      res.status(200).json({ user: req.user });
    });
    app.post('/protegida', createAuthMiddleware(jwtSecret), (_req, res) => {
      res.status(204).end();
    });
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.close();
    await once(server, 'close');
  });

  function getProtected(authorization?: string): Promise<Response> {
    return fetch(`${baseUrl}/protegida`, {
      headers: authorization === undefined ? {} : { authorization },
    });
  }

  async function expectUnauthorized(res: Response, error: string): Promise<void> {
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
    expect(await res.json()).toEqual({ error });
  }

  it('deja pasar un token válido y adjunta el usuario a la request', async () => {
    const res = await getProtected(`Bearer ${validToken}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: userId, email: 'ana@example.com', expiresAt: new Date((decode(validToken).exp ?? 0) * 1000).toISOString() },
    });
  });

  it('responde 401 cuando no hay header Authorization', async () => {
    await expectUnauthorized(await getProtected(), 'Token requerido');
  });

  it('responde 401 cuando el header no usa el esquema Bearer', async () => {
    await expectUnauthorized(await getProtected(`Basic ${validToken}`), 'Token requerido');
  });

  it('responde 401 cuando el token está malformado', async () => {
    await expectUnauthorized(await getProtected('Bearer esto.no-es.un-jwt'), 'Token inválido o expirado');
  });

  it('responde 401 cuando el token expiró', async () => {
    const expired = jwt.sign(
      { email: 'ana@example.com', exp: Math.floor(Date.now() / 1000) - 60 },
      jwtSecret,
      { algorithm: 'HS256', subject: String(userId) },
    );

    await expectUnauthorized(await getProtected(`Bearer ${expired}`), 'Token inválido o expirado');
  });

  it('responde 401 cuando el token está firmado con otro secreto', async () => {
    const forged = jwt.sign({ email: 'ana@example.com' }, 'otro-secreto', {
      algorithm: 'HS256',
      subject: String(userId),
      expiresIn: '1h',
    });

    await expectUnauthorized(await getProtected(`Bearer ${forged}`), 'Token inválido o expirado');
  });

  it('responde 401 cuando el token firmado no trae el id del usuario', async () => {
    const withoutSubject = jwt.sign({ email: 'ana@example.com' }, jwtSecret, { algorithm: 'HS256', expiresIn: '1h' });

    await expectUnauthorized(await getProtected(`Bearer ${withoutSubject}`), 'Token inválido o expirado');
  });

  describe('con la sesión en cookie', () => {
    function postProtected(headers: Record<string, string>): Promise<Response> {
      return fetch(`${baseUrl}/protegida`, { method: 'POST', headers });
    }

    it('acepta el token desde la cookie de sesión', async () => {
      const res = await fetch(`${baseUrl}/protegida`, { headers: { cookie: `otra=1; snap_session=${validToken}` } });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { user: { id: number } }).user.id).toBe(userId);
    });

    it('acepta un POST con cookie que viene del mismo origen', async () => {
      const res = await postProtected({ cookie: `snap_session=${validToken}`, origin: baseUrl });

      expect(res.status).toBe(204);
    });

    it('rechaza con 403 un POST con cookie que viene de otro origen', async () => {
      const res = await postProtected({ cookie: `snap_session=${validToken}`, origin: 'https://sitio-malicioso.example' });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Origen no permitido' });
    });

    // Un sitio ajeno no puede poner el header Authorization: sin cookie no hay riesgo de CSRF.
    it('acepta un POST con Bearer aunque venga de otro origen', async () => {
      const res = await postProtected({ authorization: `Bearer ${validToken}`, origin: 'https://otra-app.example' });

      expect(res.status).toBe(204);
    });
  });
});
