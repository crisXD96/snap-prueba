import type { DashboardOverview } from '../api.ts';
import { formatDay, formatNumber } from '../format.ts';
import { Icon } from './Icon.tsx';

type ClicksByDay = DashboardOverview['trend']['clicksByDay'];

// Unidades del viewBox: cada día mide 1 de ancho y la barra más alta, CHART_HEIGHT.
const CHART_HEIGHT = 100;
const BAR_GAP = 0.15;
// Un día sin clicks se ve como una línea, para que el eje no parezca vacío.
const MIN_BAR_HEIGHT = 1.5;
// Con más días las fechas no caben debajo de cada barra: se muestran AXIS_LABELS repartidas.
const MAX_LABELED_DAYS = 7;
const AXIS_LABELS = 5;

function clicksText(clicks: number): string {
  return `${formatNumber(clicks)} ${clicks === 1 ? 'click' : 'clicks'}`;
}

function summary(clicksByDay: ClicksByDay): string {
  const total = clicksByDay.reduce((sum, d) => sum + d.clicks, 0);
  const peak = clicksByDay.reduce<ClicksByDay[number] | undefined>(
    (best, d) => (best === undefined || d.clicks > best.clicks ? d : best),
    undefined,
  );
  if (total === 0 || peak === undefined) {
    return `Sin clicks en estos ${clicksByDay.length} días.`;
  }
  return `${clicksText(total)} en ${clicksByDay.length} días. El día con más fue el ${formatDay(peak.day)}, con ${formatNumber(peak.clicks)}.`;
}

function axisDays(clicksByDay: ClicksByDay): ClicksByDay {
  if (clicksByDay.length <= MAX_LABELED_DAYS) return clicksByDay;
  const last = clicksByDay.length - 1;
  return Array.from({ length: AXIS_LABELS }, (_, i) => clicksByDay[Math.round((i * last) / (AXIS_LABELS - 1))]).filter(
    (d) => d !== undefined,
  );
}

export function TrendChart({ clicksByDay }: { clicksByDay: ClicksByDay }) {
  // Al menos 1 para no dividir entre cero cuando ningún día tuvo clicks.
  const max = Math.max(1, ...clicksByDay.map((d) => d.clicks));
  const labelEveryDay = clicksByDay.length <= MAX_LABELED_DAYS;

  return (
    <section className="card trend">
      <h2 className="with-icon">
        <Icon name="bar-chart" />
        Clicks por día
      </h2>
      <p className="muted">{summary(clicksByDay)}</p>

      {/* El dibujo es solo visual: los lectores de pantalla leen la tabla de abajo. Las alturas van
          en atributos SVG y no en style, para que una CSP estricta no lo rompa. La key con el
          número de días vuelve a montar las barras y repite la animación al cambiar de periodo. */}
      <svg
        key={clicksByDay.length}
        className="bars"
        viewBox={`0 0 ${clicksByDay.length} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Los colores salen de las variables del tema vía CSS (stop-color), no de atributos. */}
          <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="trend-stop-top" />
            <stop offset="100%" className="trend-stop-bottom" />
          </linearGradient>
        </defs>
        {clicksByDay.map(({ day, clicks }, i) => {
          const height = Math.max(MIN_BAR_HEIGHT, (clicks / max) * CHART_HEIGHT);
          return (
            <rect
              key={day}
              className={clicks > 0 ? 'bar has-clicks' : 'bar'}
              x={i + BAR_GAP / 2}
              y={CHART_HEIGHT - height}
              width={1 - BAR_GAP}
              height={height}
            >
              <title>{`${formatDay(day)}: ${clicksText(clicks)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className={labelEveryDay ? 'bars-axis every-day' : 'bars-axis'} aria-hidden="true">
        {axisDays(clicksByDay).map(({ day }) => (
          <span key={day}>{formatDay(day)}</span>
        ))}
      </div>

      {/* Se oculta el contenedor y no la tabla: una tabla ignora height: 1px y sus filas
          alargarían la página. */}
      <div className="visually-hidden">
        <table>
          <caption>Clicks por día</caption>
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {clicksByDay.map(({ day, clicks }) => (
              <tr key={day}>
                <th scope="row">{formatDay(day)}</th>
                <td>{formatNumber(clicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
