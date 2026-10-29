import { useEffect, useState } from 'react';
import { getDashboard } from '../api.ts';
import type { DashboardOverview, DashboardUrl, Days } from '../api.ts';
import { useErrorMessage, useToken } from '../session.tsx';
import { Metrics } from './Metrics.tsx';
import { ShortenForm } from './ShortenForm.tsx';
import { TrendChart } from './TrendChart.tsx';
import { UrlList } from './UrlList.tsx';

const PERIODS: Days[] = [7, 30, 90];

export function Dashboard() {
  const token = useToken();
  const toMessage = useErrorMessage();
  const [days, setDays] = useState<Days>(7);
  // Cambiarla vuelve a pedir la primera página, p. ej. tras crear o borrar una URL.
  const [version, setVersion] = useState(0);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [items, setItems] = useState<DashboardUrl[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Descarta la respuesta si mientras tanto cambió el periodo o se pidió recargar.
    let ignore = false;
    setError(null);
    setLoading(true);
    getDashboard(token, days)
      .then(
        (result) => {
          if (ignore) return;
          setOverview(result);
          setItems(result.urls.items);
          setNextCursor(result.urls.nextCursor);
        },
        (caught: unknown) => {
          if (!ignore) setError(toMessage(caught));
        },
      )
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token, days, version, toMessage]);

  const reload = () => setVersion((v) => v + 1);

  async function loadMore() {
    if (nextCursor === null) return;
    setLoadingMore(true);
    try {
      const page = await getDashboard(token, days, nextCursor);
      setItems((current) => [...current, ...page.urls.items]);
      setNextCursor(page.urls.nextCursor);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="dashboard">
      <ShortenForm onCreated={reload} />

      <div className="toolbar">
        <div className="period" role="group" aria-label="Periodo">
          {PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              className={option === days ? 'active' : undefined}
              aria-pressed={option === days}
              onClick={() => setDays(option)}
            >
              {option} días
            </button>
          ))}
        </div>
        {/* Para ver los clicks nuevos tras probar un enlace corto sin recargar la página. */}
        <button type="button" className="secondary" disabled={loading} onClick={reload}>
          {loading ? 'Actualizando…' : 'Actualizar métricas'}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {overview === null ? (
        !error && <p className="muted">Cargando…</p>
      ) : (
        <>
          <Metrics overview={overview} />
          <TrendChart clicksByDay={overview.trend.clicksByDay} />
          <UrlList
            items={items}
            hasMore={nextCursor !== null}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            onRemoved={reload}
          />
        </>
      )}
    </div>
  );
}
