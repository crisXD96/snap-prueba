import type { DashboardOverview } from '../api.ts';
import { formatDay } from '../format.ts';

type ClicksByDay = DashboardOverview['trend']['clicksByDay'];

export function TrendChart({ clicksByDay }: { clicksByDay: ClicksByDay }) {
  // Al menos 1 para no dividir entre cero cuando ningún día tuvo clicks.
  const max = Math.max(1, ...clicksByDay.map((d) => d.clicks));
  const first = clicksByDay[0];
  const last = clicksByDay.at(-1);

  return (
    <section className="card trend">
      <h2>Clicks por día</h2>
      <ol className="bars">
        {clicksByDay.map(({ day, clicks }) => (
          <li key={day} title={`${formatDay(day)}: ${clicks} clicks`} aria-label={`${formatDay(day)}: ${clicks} clicks`}>
            <span className="bar" style={{ height: `${(clicks / max) * 100}%` }} />
          </li>
        ))}
      </ol>
      {first && last && (
        <div className="bars-axis">
          <span>{formatDay(first.day)}</span>
          <span>{formatDay(last.day)}</span>
        </div>
      )}
    </section>
  );
}
