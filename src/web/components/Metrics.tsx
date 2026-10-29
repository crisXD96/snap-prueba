import type { DashboardOverview } from '../api.ts';
import { formatChange, formatDateTime, formatNumber } from '../format.ts';

export function Metrics({ overview }: { overview: DashboardOverview }) {
  const { totals, trend, period } = overview;
  return (
    <section className="metrics" aria-label="Métricas">
      <div className="card metric">
        <span className="metric-label">Clicks en {period.days} días</span>
        <span className="metric-value">{formatNumber(trend.clicks)}</span>
        <span className="metric-detail">{formatChange(trend.changePercent)}</span>
      </div>
      <div className="card metric">
        <span className="metric-label">Clicks totales</span>
        <span className="metric-value">{formatNumber(totals.clicks)}</span>
        <span className="metric-detail">Último: {formatDateTime(totals.lastClickAt)}</span>
      </div>
      <div className="card metric">
        <span className="metric-label">URLs</span>
        <span className="metric-value">{formatNumber(totals.urls)}</span>
        <span className="metric-detail">{formatNumber(totals.urlsWithoutClicks)} sin clicks</span>
      </div>
    </section>
  );
}
