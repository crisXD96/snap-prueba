import type { DashboardRepository, DashboardTotals, DayClicks, PageCursor } from './dashboard.repository.ts';

const ALLOWED_DAYS = [7, 30, 90];
const DEFAULT_DAYS = 7;
const PAGE_SIZE = 50;
// Centro de México: no cambia de horario, así que el desplazamiento es fijo.
const UTC_OFFSET_HOURS = -6;
const UTC_OFFSET = `${UTC_OFFSET_HOURS < 0 ? '-' : '+'}${String(Math.abs(UTC_OFFSET_HOURS)).padStart(2, '0')}:00`;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CURSOR_ID_PATTERN = /^[1-9]\d*$/;

export class InvalidDashboardQueryError extends Error {}

// Llegan sin tipar desde la query string; el servicio los valida.
export interface DashboardQuery {
  days: unknown;
  cursor: unknown;
}

export interface DashboardUrl {
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
  lastClickAt: string | null;
}

export interface DashboardOverview {
  period: { days: number; from: string; to: string; utcOffset: string };
  // Todo el historial; trend solo cubre el periodo.
  totals: DashboardTotals;
  trend: {
    clicks: number;
    previousClicks: number;
    // null cuando el periodo anterior no tuvo clicks: no hay contra qué comparar.
    changePercent: number | null;
    clicksByDay: DayClicks[];
  };
  urls: { items: DashboardUrl[]; nextCursor: string | null };
}

export interface DashboardService {
  getOverview(userId: number, query: DashboardQuery): DashboardOverview;
}

function parseDays(raw: unknown): number {
  if (raw === undefined) return DEFAULT_DAYS;
  const days = ALLOWED_DAYS.find((allowed) => String(allowed) === raw);
  if (days === undefined) {
    throw new InvalidDashboardQueryError('El parámetro days debe ser 7, 30 o 90');
  }
  return days;
}

// Opaco para el cliente: si cambia cómo se pagina, no hay URLs armadas a mano que romper.
function encodeCursor({ createdAt, id }: PageCursor): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

function decodeCursor(raw: unknown): PageCursor | undefined {
  if (raw === undefined) return undefined;
  const decoded = typeof raw === 'string' ? Buffer.from(raw, 'base64url').toString('utf8') : '';
  const separator = decoded.lastIndexOf('|');
  const id = decoded.slice(separator + 1);
  if (separator <= 0 || !CURSOR_ID_PATTERN.test(id)) {
    throw new InvalidDashboardQueryError('El cursor no es válido');
  }
  return { createdAt: decoded.slice(0, separator), id: Number(id) };
}

function toDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Los límites se pasan a UTC con el mismo formato que clicked_at, para compararlos como texto.
function periodBounds(now: Date, days: number) {
  const offsetMs = UTC_OFFSET_HOURS * HOUR_MS;
  // Medianoche del día local de hoy, contada como si fuera UTC: sirve para nombrar los días.
  const today = Math.floor((now.getTime() + offsetMs) / DAY_MS) * DAY_MS;
  const firstDay = today - (days - 1) * DAY_MS;
  return {
    dayNames: Array.from({ length: days }, (_, i) => toDay(firstDay + i * DAY_MS)),
    from: toDay(firstDay),
    to: toDay(today),
    since: new Date(firstDay - offsetMs).toISOString(),
    previousSince: new Date(firstDay - days * DAY_MS - offsetMs).toISOString(),
  };
}

// now es inyectable para fijar la fecha en los tests.
export function createDashboardService(
  repository: DashboardRepository,
  now: () => Date = () => new Date(),
): DashboardService {
  return {
    getOverview(userId, query) {
      const days = parseDays(query.days);
      const after = decodeCursor(query.cursor);
      const { dayNames, from, to, since, previousSince } = periodBounds(now(), days);

      const clicksPerDay = new Map(repository.clicksByDay(userId, since, UTC_OFFSET_HOURS).map((d) => [d.day, d.clicks]));
      const clicksByDay = dayNames.map((day) => ({ day, clicks: clicksPerDay.get(day) ?? 0 }));
      const clicks = clicksByDay.reduce((sum, d) => sum + d.clicks, 0);
      const previousClicks = repository.countClicks(userId, previousSince, since);

      // Se pide una de más para saber si hay otra página sin contar todas las URLs.
      const page = repository.urlsPage(userId, PAGE_SIZE + 1, after);
      const items = page.slice(0, PAGE_SIZE);
      const last = items.at(-1);

      return {
        period: { days, from, to, utcOffset: UTC_OFFSET },
        totals: repository.totals(userId),
        trend: {
          clicks,
          previousClicks,
          changePercent: previousClicks === 0 ? null : Math.round(((clicks - previousClicks) / previousClicks) * 1000) / 10,
          clicksByDay,
        },
        urls: {
          items: items.map(({ code, url, createdAt, clicks, lastClickAt }) => ({ code, url, createdAt, clicks, lastClickAt })),
          nextCursor: page.length > PAGE_SIZE && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
        },
      };
    },
  };
}
