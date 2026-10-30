import { vi } from 'vitest';
import type { DashboardOverview, DashboardUrl, DashboardUrlsPage } from '../api.ts';

// Una promesa permite decidir cuándo llega la respuesta, p. ej. para probar respuestas que llegan tarde.
type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

// Toda la app pregunta por la sesión al arrancar y la cierra en el servidor al salir: por defecto
// no hay cookie de sesión. Un test que necesite otra cosa declara su propia ruta.
const SESSION_ROUTES: Record<string, Handler> = {
  'GET /auth/me': () => jsonResponse(401, { error: 'Token requerido' }),
  'POST /auth/logout': () => new Response(null, { status: 204 }),
};

// La red es el único borde que se simula: cada clave es "MÉTODO ruta" tal como la pide la SPA.
export function mockFetch(routes: Record<string, Handler>) {
  const allRoutes = { ...SESSION_ROUTES, ...routes };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = allRoutes[key];
    if (!handler) {
      throw new Error(`Petición no esperada: ${key}`);
    }
    return handler(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const ana = { id: 1, email: 'ana@example.com', name: 'Ana', createdAt: '2026-10-01T12:00:00.000Z' };

// Body del login, del registro o de /auth/me. El token real viaja en la cookie: la SPA nunca lo lee.
export function authResult(expiresInSeconds = 3600) {
  return { user: ana, token: 'token-que-la-spa-ignora', expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}

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
    ...overrides,
  };
}

export function urlsPage(items: DashboardUrl[] = [], nextCursor: string | null = null): DashboardUrlsPage {
  return { items, nextCursor };
}
