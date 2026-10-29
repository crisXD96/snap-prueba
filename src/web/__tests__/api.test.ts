import { describe, expect, it, vi } from 'vitest';
import { ApiError, getDashboard, login, removeUrl, shorten } from '../api.ts';
import { jsonResponse, mockFetch } from './fetch-mock.ts';

describe('cliente de la API', () => {
  it('envía el token como Bearer y el body como JSON', async () => {
    const fetchMock = mockFetch({ 'POST /urls': () => jsonResponse(201, { code: 'aB3xK9z', url: 'https://ejemplo.com' }) });

    const result = await shorten('mi-token', 'ejemplo.com');

    expect(result).toEqual({ code: 'aB3xK9z', url: 'https://ejemplo.com' });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer mi-token' });
    expect(init?.body).toBe(JSON.stringify({ url: 'ejemplo.com' }));
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

    await expect(shorten('mi-token', 'ejemplo.com')).rejects.toMatchObject({
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

    await expect(removeUrl('mi-token', 'aB3xK9z')).resolves.toBeUndefined();
  });

  it('pide el dashboard sin cursor en la primera página y con cursor en las siguientes', async () => {
    const fetchMock = mockFetch({
      'GET /dashboard?days=30': () => jsonResponse(200, {}),
      'GET /dashboard?days=30&cursor=abc': () => jsonResponse(200, {}),
    });

    await getDashboard('mi-token', 30);
    await getDashboard('mi-token', 30, 'abc');

    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual(['/dashboard?days=30', '/dashboard?days=30&cursor=abc']);
  });
});
