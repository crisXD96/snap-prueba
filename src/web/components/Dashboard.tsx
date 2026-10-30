import { useEffect, useRef, useState } from 'react';
import { getDashboard, getDashboardUrls } from '../api.ts';
import type { DashboardOverview, DashboardUrl, Days, ShortUrl } from '../api.ts';
import { useErrorMessage, useToken } from '../session.tsx';
import { Icon } from './Icon.tsx';
import { Metrics } from './Metrics.tsx';
import { ShortenForm } from './ShortenForm.tsx';
import { TrendChart } from './TrendChart.tsx';
import { UrlList } from './UrlList.tsx';

const PERIODS: Days[] = [7, 30, 90];
export const METRICS_REFRESH_MS = 30_000;

export function Dashboard() {
  const token = useToken();
  const toMessage = useErrorMessage();
  const [days, setDays] = useState<Days>(7);
  // Cambiarla vuelve a pedir métricas y primera página, p. ej. tras crear o borrar una URL.
  const [version, setVersion] = useState(0);
  // Solo las métricas se refrescan solas: recargar la lista perdería las páginas de "Cargar más".
  const [metricsTick, setMetricsTick] = useState(0);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [items, setItems] = useState<DashboardUrl[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [created, setCreated] = useState<ShortUrl | null>(null);
  // Cambia con cada carga de la primera página: una página siguiente pedida antes ya no corresponde.
  const listGeneration = useRef(0);

  // Las métricas dependen del periodo; la lista no, así que cambiar el periodo no la recarga.
  useEffect(() => {
    // Descarta la respuesta si mientras tanto cambió el periodo o se pidió recargar.
    let ignore = false;
    setMetricsError(null);
    setLoadingMetrics(true);
    getDashboard(token, days)
      .then(
        (result) => {
          if (!ignore) setOverview(result);
        },
        (caught: unknown) => {
          if (!ignore) setMetricsError(toMessage(caught));
        },
      )
      .finally(() => {
        if (!ignore) setLoadingMetrics(false);
      });
    return () => {
      ignore = true;
    };
  }, [token, days, version, metricsTick, toMessage]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Con la pestaña oculta nadie mira el panel: no vale la pena consultar al servidor.
      if (document.visibilityState === 'visible') setMetricsTick((tick) => tick + 1);
    }, METRICS_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;
    listGeneration.current += 1;
    setListError(null);
    setLoadingList(true);
    getDashboardUrls(token)
      .then(
        (page) => {
          if (ignore) return;
          setItems(page.items);
          setNextCursor(page.nextCursor);
        },
        (caught: unknown) => {
          if (!ignore) setListError(toMessage(caught));
        },
      )
      .finally(() => {
        if (!ignore) setLoadingList(false);
      });
    return () => {
      ignore = true;
    };
  }, [token, version, toMessage]);

  const reload = () => setVersion((v) => v + 1);

  function handleCreatedChange(next: ShortUrl | null) {
    setCreated(next);
    if (next !== null) reload();
  }

  function handleRemoved(code: string) {
    setCreated((current) => (current?.code === code ? null : current));
    reload();
  }

  async function loadMore() {
    if (nextCursor === null) return;
    const generation = listGeneration.current;
    setLoadingMore(true);
    try {
      const page = await getDashboardUrls(token, nextCursor);
      if (generation !== listGeneration.current) return;
      setItems((current) => [...(current ?? []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (generation === listGeneration.current) setListError(toMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  const loading = loadingMetrics || loadingList;
  // Si fallan las dos cargas suele ser por lo mismo (p. ej. sin conexión): un solo aviso basta.
  const error = metricsError ?? listError;

  return (
    <div className="dashboard">
      <ShortenForm created={created} onCreatedChange={handleCreatedChange} />

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
        <div className="toolbar-end">
          <span className="live">
            <span className="live-dot" aria-hidden="true" />
            Se actualiza solo cada {METRICS_REFRESH_MS / 1000} s
          </span>
          {/* Para ver los clicks nuevos al momento, sin esperar al refresco automático. */}
          <button type="button" className="secondary with-icon" disabled={loading} onClick={reload}>
            <Icon name="refresh-cw" className={loading ? 'spin' : undefined} />
            {loading ? 'Actualizando…' : 'Actualizar métricas'}
          </button>
        </div>
      </div>

      {error && (
        <p className="error with-icon" role="alert">
          <Icon name="circle-alert" />
          {error}
        </p>
      )}

      {overview === null ? (
        !metricsError && (
          <div className="skeletons">
            <p className="visually-hidden">Cargando métricas…</p>
            <div className="metrics" aria-hidden="true">
              <div className="card skeleton" />
              <div className="card skeleton" />
              <div className="card skeleton" />
            </div>
            <div className="card skeleton skeleton-chart" aria-hidden="true" />
          </div>
        )
      ) : (
        <>
          <Metrics overview={overview} />
          <TrendChart clicksByDay={overview.trend.clicksByDay} />
        </>
      )}
      {items !== null && (
        <UrlList
          items={items}
          hasMore={nextCursor !== null}
          loadingMore={loadingMore}
          highlightCode={created?.code ?? null}
          onLoadMore={loadMore}
          onRemoved={handleRemoved}
        />
      )}
    </div>
  );
}
