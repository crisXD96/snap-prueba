// Cliente de la API de Snap. Las rutas son relativas: la SPA comparte origen con la API.

export class ApiError extends Error {
  // 0 cuando no hubo respuesta del servidor.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export interface ShortUrl {
  code: string;
  url: string;
}

export type Days = 7 | 30 | 90;

export interface DashboardUrl {
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
  lastClickAt: string | null;
}

export interface DashboardOverview {
  period: { days: number; from: string; to: string; utcOffset: string };
  totals: { urls: number; clicks: number; urlsWithoutClicks: number; lastClickAt: string | null };
  trend: {
    clicks: number;
    previousClicks: number;
    changePercent: number | null;
    clicksByDay: { day: string; clicks: number }[];
  };
}

export interface DashboardUrlsPage {
  items: DashboardUrl[];
  nextCursor: string | null;
}

export const UNEXPECTED_ERROR = 'Ocurrió un error inesperado. Intenta de nuevo.';
const NETWORK_ERROR = 'No se pudo conectar con el servidor.';

interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

async function errorMessage(res: Response): Promise<string> {
  // Solo los errores esperados traen { error }; los 500 y el JSON mal formado llegan como HTML de Express.
  if (!res.headers.get('content-type')?.includes('application/json')) return UNEXPECTED_ERROR;
  const data: unknown = await res.json().catch(() => undefined);
  if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
    return data.error;
  }
  return UNEXPECTED_ERROR;
}

async function request<T>(path: string, { method = 'GET', token, body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token !== undefined) headers.authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
  return request('/auth/register', { method: 'POST', body: input });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return request('/auth/login', { method: 'POST', body: { email, password } });
}

export function shorten(token: string, url: string): Promise<ShortUrl> {
  return request('/urls', { method: 'POST', token, body: { url } });
}

export function removeUrl(token: string, code: string): Promise<void> {
  return request(`/urls/${encodeURIComponent(code)}`, { method: 'DELETE', token });
}

export function getDashboard(token: string, days: Days): Promise<DashboardOverview> {
  return request(`/dashboard?${new URLSearchParams({ days: String(days) })}`, { token });
}

export function getDashboardUrls(token: string, cursor?: string): Promise<DashboardUrlsPage> {
  // El backend rechaza un cursor vacío: si no hay, se omite.
  const query = cursor === undefined ? '' : `?${new URLSearchParams({ cursor })}`;
  return request(`/dashboard/urls${query}`, { token });
}
