import type { DatabaseSync } from 'node:sqlite';
import { lazyStatement } from '../../shared/db.ts';

export interface DashboardTotals {
  urls: number;
  clicks: number;
  urlsWithoutClicks: number;
  lastClickAt: string | null;
}

export interface UrlStats {
  // rowid: desempata al paginar las URLs creadas en el mismo milisegundo.
  id: number;
  code: string;
  url: string;
  createdAt: string;
  clicks: number;
  lastClickAt: string | null;
}

// Última URL de la página anterior; la siguiente empieza justo después.
export interface PageCursor {
  createdAt: string;
  id: number;
}

export interface DayClicks {
  day: string;
  clicks: number;
}

export interface DashboardRepository {
  totals(userId: number): DashboardTotals;
  // De la URL más reciente a la más antigua.
  urlsPage(userId: number, limit: number, after?: PageCursor): UrlStats[];
  // Solo los días con clicks; day es la fecha local tras desplazar clicked_at utcOffsetHours.
  clicksByDay(userId: number, since: string, utcOffsetHours: number): DayClicks[];
  // Clicks con from <= clicked_at < to.
  countClicks(userId: number, from: string, to: string): number;
}

interface UrlStatsRow {
  id: number;
  code: string;
  original_url: string;
  created_at: string;
  clicks: number;
  last_click_at: string | null;
}

interface TotalsRow {
  urls: number;
  clicks: number;
  urls_without_clicks: number;
  last_click_at: string | null;
}

// Subconsultas por URL en lugar de JOIN + GROUP BY: así SQLite recorre las URLs en el orden
// del índice (user_id, created_at) y corta en el LIMIT sin ordenar todas las del usuario.
const CLICK_STATS_COLUMNS = `
  (SELECT COUNT(*) FROM clicks c WHERE c.code = u.code) AS clicks,
  (SELECT MAX(c.clicked_at) FROM clicks c WHERE c.code = u.code) AS last_click_at`;
const URL_STATS_COLUMNS = `u.rowid AS id, u.code, u.original_url, u.created_at, ${CLICK_STATS_COLUMNS}`;

function toUrlStats(row: UrlStatsRow): UrlStats {
  return {
    id: row.id,
    code: row.code,
    url: row.original_url,
    createdAt: row.created_at,
    clicks: row.clicks,
    lastClickAt: row.last_click_at,
  };
}

export function createDashboardRepository(db: DatabaseSync): DashboardRepository {
  const totals = lazyStatement(
    db,
    // MATERIALIZED: sin él, SQLite repite el conteo de clicks por cada SUM que lo usa.
    `WITH stats AS MATERIALIZED (SELECT ${CLICK_STATS_COLUMNS} FROM urls u WHERE u.user_id = ?)
     SELECT COUNT(*) AS urls,
            COALESCE(SUM(clicks), 0) AS clicks,
            COALESCE(SUM(clicks = 0), 0) AS urls_without_clicks,
            MAX(last_click_at) AS last_click_at
     FROM stats`,
  );
  const firstPage = lazyStatement(
    db,
    `SELECT ${URL_STATS_COLUMNS} FROM urls u
     WHERE u.user_id = ?
     ORDER BY u.created_at DESC, u.rowid DESC LIMIT ?`,
  );
  const pageAfter = lazyStatement(
    db,
    `SELECT ${URL_STATS_COLUMNS} FROM urls u
     WHERE u.user_id = ? AND (u.created_at, u.rowid) < (?, ?)
     ORDER BY u.created_at DESC, u.rowid DESC LIMIT ?`,
  );
  const clicksByDay = lazyStatement(
    db,
    `SELECT date(c.clicked_at, ?) AS day, COUNT(*) AS clicks
     FROM clicks c JOIN urls u ON u.code = c.code
     WHERE u.user_id = ? AND c.clicked_at >= ?
     GROUP BY day`,
  );
  const countClicks = lazyStatement(
    db,
    `SELECT COUNT(*) AS clicks
     FROM clicks c JOIN urls u ON u.code = c.code
     WHERE u.user_id = ? AND c.clicked_at >= ? AND c.clicked_at < ?`,
  );

  return {
    totals(userId) {
      const row = totals().get(userId) as unknown as TotalsRow;
      return {
        urls: row.urls,
        clicks: row.clicks,
        urlsWithoutClicks: row.urls_without_clicks,
        lastClickAt: row.last_click_at,
      };
    },

    urlsPage(userId, limit, after) {
      const rows = (
        after ? pageAfter().all(userId, after.createdAt, after.id, limit) : firstPage().all(userId, limit)
      ) as unknown as UrlStatsRow[];
      return rows.map(toUrlStats);
    },

    clicksByDay(userId, since, utcOffsetHours) {
      return clicksByDay().all(`${utcOffsetHours} hours`, userId, since) as unknown as DayClicks[];
    },

    countClicks(userId, from, to) {
      const row = countClicks().get(userId, from, to) as unknown as { clicks: number };
      return row.clicks;
    },
  };
}
