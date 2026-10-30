import type { DashboardOverview } from '../api.ts';
import { formatChange, formatDateTime, formatNumber } from '../format.ts';
import { useCountUp } from '../useCountUp.ts';
import { Icon } from './Icon.tsx';
import type { IconName } from './Icon.tsx';

function Metric({ icon, tone, label, value, children }: {
  icon: IconName;
  tone: 'accent' | 'success' | 'violet';
  label: string;
  value: number;
  children: React.ReactNode;
}) {
  const shown = useCountUp(value);
  return (
    <div className={`card metric metric-${tone}`}>
      <span className="metric-icon">
        <Icon name={icon} size={20} />
      </span>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{formatNumber(shown)}</span>
      <span className="metric-detail">{children}</span>
    </div>
  );
}

function trendTone(changePercent: number | null): { icon: IconName; className: string } {
  if (changePercent === null || changePercent === 0) return { icon: 'activity', className: 'trend-badge' };
  return changePercent > 0
    ? { icon: 'trending-up', className: 'trend-badge is-up' }
    : { icon: 'trending-down', className: 'trend-badge is-down' };
}

export function Metrics({ overview }: { overview: DashboardOverview }) {
  const { totals, trend, period } = overview;
  const badge = trendTone(trend.changePercent);
  return (
    <section className="metrics" aria-label="Métricas">
      <Metric icon="mouse-pointer-click" tone="accent" label={`Clicks en ${period.days} días`} value={trend.clicks}>
        <span className={badge.className}>
          <Icon name={badge.icon} size={14} />
          {formatChange(trend.changePercent)}
        </span>
      </Metric>
      <Metric icon="activity" tone="success" label="Clicks totales" value={totals.clicks}>
        Último: {formatDateTime(totals.lastClickAt)}
      </Metric>
      <Metric icon="link" tone="violet" label="URLs" value={totals.urls}>
        {formatNumber(totals.urlsWithoutClicks)} sin clicks
      </Metric>
    </section>
  );
}
