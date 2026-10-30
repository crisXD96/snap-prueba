import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.ts';
import { createTestDatabase } from '../../../shared/__tests__/test-database.ts';
import { createUsersRepository } from '../../auth/auth.repository.ts';
import { createDashboardRepository } from '../dashboard.repository.ts';
import { createDashboardService } from '../dashboard.service.ts';
import type { DashboardOverview } from '../dashboard.service.ts';

describe('GET /dashboard', () => {
  let server: Server;
  let baseUrl: string;

  // Cada test usa su propio usuario para que los datos de uno no se cuelen en otro.
  async function registerUser(alias: string): Promise<string> {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `${alias}@example.com`, password: 'contraseña-segura-123', name: alias }),
    });
    return ((await res.json()) as { token: string }).token;
  }

  async function createShortUrl(url: string, token: string): Promise<string> {
    const res = await fetch(`${baseUrl}/urls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    });
    return ((await res.json()) as { code: string }).code;
  }

  async function visit(code: string, times: number): Promise<void> {
    for (let i = 0; i < times; i++) {
      await fetch(`${baseUrl}/${code}`, { redirect: 'manual' });
    }
  }

  function getDashboard(token: string | null, query = ''): Promise<Response> {
    return fetch(`${baseUrl}/dashboard${query}`, {
      headers: token === null ? {} : { authorization: `Bearer ${token}` },
    });
  }

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

  it('responde 401 cuando no hay token', async () => {
    const res = await getDashboard(null);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Token requerido' });
  });

  it('responde 401 cuando el token no es válido', async () => {
    const res = await getDashboard('token-falso');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Token inválido o expirado' });
  });

  it('devuelve totales y tendencia en cero para un usuario sin urls', async () => {
    const token = await registerUser('sin-urls');

    const res = await getDashboard(token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as DashboardOverview;
    expect(body.period).toMatchObject({ days: 7, utcOffset: '-06:00' });
    expect(body.totals).toEqual({ urls: 0, clicks: 0, urlsWithoutClicks: 0, lastClickAt: null });
    expect(body.trend).toMatchObject({ clicks: 0, previousClicks: 0, changePercent: null });
    expect(body.trend.clicksByDay).toHaveLength(7);
    expect(body.trend.clicksByDay.every((d) => d.clicks === 0)).toBe(true);
    expect(body.urls).toEqual({ items: [], nextCursor: null });
  });

  it('devuelve los totales, la tendencia y el rendimiento de las urls del usuario autenticado', async () => {
    const token = await registerUser('con-urls');
    const otherToken = await registerUser('otro-usuario');
    const visited = await createShortUrl('https://example.com/visitada', token);
    const unvisited = await createShortUrl('https://example.com/sin-visitas', token);
    const foreign = await createShortUrl('https://example.com/ajena', otherToken);
    await visit(visited, 3);
    await visit(foreign, 2);

    const res = await getDashboard(token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as DashboardOverview;
    expect(body.totals).toEqual({ urls: 2, clicks: 3, urlsWithoutClicks: 1, lastClickAt: expect.any(String) });
    expect(body.trend).toMatchObject({ clicks: 3, previousClicks: 0, changePercent: null });
    expect(body.trend.clicksByDay.at(-1)).toEqual({ day: body.period.to, clicks: 3 });
    expect(body.urls).toEqual({
      items: [
        { code: unvisited, url: 'https://example.com/sin-visitas', createdAt: expect.any(String), clicks: 0, lastClickAt: null },
        { code: visited, url: 'https://example.com/visitada', createdAt: expect.any(String), clicks: 3, lastClickAt: body.totals.lastClickAt },
      ],
      nextCursor: null,
    });
  });

  it('devuelve una serie de 30 días cuando se pide days=30', async () => {
    const token = await registerUser('treinta-dias');

    const body = (await (await getDashboard(token, '?days=30')).json()) as DashboardOverview;

    expect(body.period.days).toBe(30);
    expect(body.trend.clicksByDay).toHaveLength(30);
  });

  it('rechaza con 400 un days distinto de 7, 30 o 90', async () => {
    const token = await registerUser('days-invalido');

    const res = await getDashboard(token, '?days=15');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El parámetro days debe ser 7, 30 o 90' });
  });

  it('rechaza con 400 un cursor que no generó el servidor', async () => {
    const token = await registerUser('cursor-invalido');

    const res = await getDashboard(token, '?cursor=no-es-un-cursor');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'El cursor no es válido' });
  });
});

describe('servicio de dashboard', () => {
  // Mediodía en Ciudad de México: el periodo de 7 días va del 23 al 29 de octubre locales.
  const NOW = '2026-10-29T18:00:00.000Z';

  function setup() {
    const db = createTestDatabase();
    const users = createUsersRepository(db);
    const user = users.insert({ email: 'ana@example.com', passwordHash: 'hash', name: 'Ana' });
    if (!user) throw new Error('No se pudo crear el usuario de prueba');
    const service = createDashboardService(createDashboardRepository(db), () => new Date(NOW));

    function addUrl(code: string, createdAt = '2026-10-01T00:00:00.000Z'): void {
      db.prepare('INSERT INTO urls (code, original_url, user_id, created_at) VALUES (?, ?, ?, ?)').run(
        code,
        `https://example.com/${code}`,
        user?.id ?? null,
        createdAt,
      );
    }

    function addClick(code: string, clickedAt: string): void {
      db.prepare('INSERT INTO clicks (code, clicked_at) VALUES (?, ?)').run(code, clickedAt);
    }

    return { service, userId: user.id, addUrl, addClick };
  }

  it('agrupa por día local: un click a las 03:00 UTC cuenta en el día anterior', () => {
    const { service, userId, addUrl, addClick } = setup();
    addUrl('aaaaaaa');
    addClick('aaaaaaa', '2026-10-29T03:00:00.000Z');
    addClick('aaaaaaa', '2026-10-29T07:00:00.000Z');

    const { period, trend } = service.getOverview(userId, { days: undefined, cursor: undefined });

    expect(period).toEqual({ days: 7, from: '2026-10-23', to: '2026-10-29', utcOffset: '-06:00' });
    expect(trend.clicksByDay).toEqual([
      { day: '2026-10-23', clicks: 0 },
      { day: '2026-10-24', clicks: 0 },
      { day: '2026-10-25', clicks: 0 },
      { day: '2026-10-26', clicks: 0 },
      { day: '2026-10-27', clicks: 0 },
      { day: '2026-10-28', clicks: 1 },
      { day: '2026-10-29', clicks: 1 },
    ]);
  });

  it('compara contra el periodo anterior y no cuenta en la tendencia los clicks más antiguos', () => {
    const { service, userId, addUrl, addClick } = setup();
    addUrl('aaaaaaa');
    // El periodo actual empieza a la medianoche local del 23: 06:00 UTC.
    addClick('aaaaaaa', '2026-10-23T06:00:00.000Z');
    addClick('aaaaaaa', '2026-10-25T12:00:00.000Z');
    addClick('aaaaaaa', '2026-10-25T13:00:00.000Z');
    addClick('aaaaaaa', '2026-10-25T14:00:00.000Z');
    addClick('aaaaaaa', '2026-10-23T05:59:59.999Z');
    addClick('aaaaaaa', '2026-10-20T12:00:00.000Z');
    addClick('aaaaaaa', '2026-10-16T06:00:00.000Z');
    addClick('aaaaaaa', '2026-10-10T12:00:00.000Z');

    const { totals, trend } = service.getOverview(userId, { days: '7', cursor: undefined });

    expect(trend).toMatchObject({ clicks: 4, previousClicks: 3, changePercent: 33.3 });
    expect(totals).toEqual({ urls: 1, clicks: 8, urlsWithoutClicks: 0, lastClickAt: '2026-10-25T14:00:00.000Z' });
  });

  it('pagina las urls de la más reciente a la más antigua sin repetir ni saltar ninguna', () => {
    const { service, userId, addUrl } = setup();
    // Todas con la misma fecha: el orden y el corte de página dependen del desempate.
    const codes = Array.from({ length: 52 }, (_, i) => `u${String(i).padStart(6, '0')}`);
    codes.forEach((code) => addUrl(code));

    const first = service.getOverview(userId, { days: undefined, cursor: undefined }).urls;
    const second = service.getOverview(userId, { days: undefined, cursor: first.nextCursor ?? undefined }).urls;

    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((item) => item.code)).toEqual([...codes].reverse());
  });
});
