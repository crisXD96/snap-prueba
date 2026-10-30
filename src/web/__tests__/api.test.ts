import { describe, expect, it, vi } from 'vitest';
import { ApiError, getDashboard, getDashboardUrls, getSession, login, logout, removeUrl, shorten } from '../api.ts';
import { jsonResponse, mockFetch } from './fetch-mock.ts';

describe('cliente de la API', () => {
  it('envía el body como JSON con la cookie de sesión del mismo origen y sin header Authorization', async () => {
    const fetchMock = mockFetch({ 'POST /urls': () => jsonResponse(201, { code: 'aB3xK9z', url: 'https://ejemplo.com' }) });

    const result = await shorten('ejemplo.com');

    expect(result).toEqual({ code: 'aB3xK9z', url: 'https://ejemplo.com' });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(init?.credentials).toBe('same-origin');
    expect(init?.body).toBe(JSON.stringify({ url: 'ejemplo.com' }));
  });

  it('pregunta por la sesión actual y la cierra en el servidor', async () => {
    const fetchMock = mockFetch({
      'GET /auth/me': () => jsonResponse(200, { user: { id: 1 }, expiresAt: '2026-10-31T00:00:00.000Z' }),
      'POST /auth/logout': () => new Response(null, { status: 204 }),
    });

    await expect(getSession()).resolves.toMatchObject({ expiresAt: '2026-10-31T00:00:00.000Z' });
    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}`)).toEqual([
      'GET /auth/me',
      'POST /auth/logout',
    ]);
  });

  it('convierte el { error } del backend en un ApiError con su status', async () => {
    mockFetch({ 'POST /auth/login': () => jsonResponse(401, { error: 'Email o password incorrectos' }) });

    const failure = login('ana@example.com', 'incorrecta');

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 401, message: 'Email o password incorrectos' });
  });

  it('usa un mensaje genérico cuando el error llega como HTML de Express', async () => {
    mockFetch({
      'POST /urls': () => new Response('<pre>Internal Server Error</pre>', { status: 500, headers: { 'content-type': 'text/html' } }),
    });

    await expect(shorten('ejemplo.com')).rejects.toMatchObject({
      status: 500,
      message: 'Ocurrió un error inesperado. Intenta de nuevo.',
    });
  });

  it('informa cuando no se puede conectar con el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(login('ana@example.com', 'x')).rejects.toMatchObject({ status: 0, message: 'No se pudo conectar con el servidor.' });
  });

  it('resuelve un borrado con 204 sin leer body', async () => {
    mockFetch({ 'DELETE /urls/aB3xK9z': () => new Response(null, { status: 204 }) });

    await expect(removeUrl('aB3xK9z')).resolves.toBeUndefined();
  });

  it('pide las métricas del periodo y la lista de URLs por separado', async () => {
    const fetchMock = mockFetch({
      'GET /dashboard?days=30': () => jsonResponse(200, {}),
      'GET /dashboard/urls': () => jsonResponse(200, {}),
      'GET /dashboard/urls?cursor=abc': () => jsonResponse(200, {}),
    });

    await getDashboard(30);
    await getDashboardUrls();
    await getDashboardUrls('abc');

    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual([
      '/dashboard?days=30',
      '/dashboard/urls',
      '/dashboard/urls?cursor=abc',
    ]);
  });
});
