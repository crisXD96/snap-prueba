import { vi } from 'vitest';
import type { DashboardOverview, DashboardUrl } from '../api.ts';

// Una promesa permite decidir cuándo llega la respuesta, p. ej. para probar respuestas que llegan tarde.
type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

// La red es el único borde que se simula: cada clave es "MÉTODO ruta" tal como la pide la SPA.
export function mockFetch(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = routes[key];
    if (!handler) {
      throw new Error(`Petición no esperada: ${key}`);
    }
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function base64Url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// La SPA solo lee exp; la firma la valida el backend.
export function fakeToken(expiresInSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({ sub: '1', email: 'ana@example.com', exp })}.firma`;
}

export const ana = { id: 1, email: 'ana@example.com', name: 'Ana', createdAt: '2026-10-01T12:00:00.000Z' };

export function urlItem(code: string, overrides: Partial<DashboardUrl> = {}): DashboardUrl {
  return {
    code,
    url: `https://example.com/${code}`,
    createdAt: '2026-10-20T15:00:00.000Z',
    clicks: 0,
    lastClickAt: null,
    ...overrides,
  };
}

export function overview(items: DashboardUrl[] = [], overrides: Partial<DashboardOverview> = {}): DashboardOverview {
  return {
    period: { days: 7, from: '2026-10-23', to: '2026-10-29', utcOffset: '-06:00' },
    totals: { urls: items.length, clicks: 0, urlsWithoutClicks: items.length, lastClickAt: null },
    trend: {
      clicks: 0,
      previousClicks: 0,
      changePercent: null,
      clicksByDay: ['23', '24', '25', '26', '27', '28', '29'].map((d) => ({ day: `2026-10-${d}`, clicks: 0 })),
    },
    urls: { items, nextCursor: null },
    ...overrides,
  };
}
