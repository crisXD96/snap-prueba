import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendChart } from '../components/TrendChart.tsx';
import { formatDay } from '../format.ts';

// Días consecutivos desde el 1 de agosto, con los clicks indicados o en cero.
function days(count: number, clicks: Record<number, number> = {}) {
  return Array.from({ length: count }, (_, i) => ({
    day: new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10),
    clicks: clicks[i] ?? 0,
  }));
}

describe('gráfica de clicks por día', () => {
  it('resume el periodo con el total y el día con más clicks', () => {
    const clicksByDay = days(7, { 1: 4, 3: 9, 5: 9 });

    render(<TrendChart clicksByDay={clicksByDay} />);

    expect(
      screen.getByText(`22 clicks en 7 días. El día con más fue el ${formatDay('2026-08-04')}, con 9.`),
    ).toBeTruthy();
  });

  it('dice que no hubo clicks cuando todo el periodo está en cero', () => {
    render(<TrendChart clicksByDay={days(30)} />);

    expect(screen.getByText('Sin clicks en estos 30 días.')).toBeTruthy();
  });

  it('ofrece a los lectores de pantalla una tabla con los clicks de cada día', () => {
    render(<TrendChart clicksByDay={days(7, { 2: 1 })} />);

    const table = screen.getByRole('table', { name: 'Clicks por día' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(8);
    expect(within(rows[3] as HTMLElement).getByRole('rowheader').textContent).toBe(formatDay('2026-08-03'));
    expect(within(rows[3] as HTMLElement).getByRole('cell').textContent).toBe('1');
  });

  it('con 7 días etiqueta cada día en el eje', () => {
    render(<TrendChart clicksByDay={days(7)} />);

    // Cada fecha aparece en el eje y en la tabla.
    for (const { day } of days(7)) {
      expect(screen.getAllByText(formatDay(day))).toHaveLength(2);
    }
  });

  it('con 90 días etiqueta el eje con cinco fechas repartidas, incluidos el primer y el último día', () => {
    const clicksByDay = days(90);

    render(<TrendChart clicksByDay={clicksByDay} />);

    const labeled = clicksByDay.filter(({ day }) => screen.getAllByText(formatDay(day)).length === 2);
    expect(labeled.map(({ day }) => day)).toEqual([
      '2026-08-01',
      '2026-08-23',
      '2026-09-15',
      '2026-10-07',
      '2026-10-29',
    ]);
  });

  it('no usa estilos inline, para que una CSP estricta no rompa la gráfica', () => {
    const { container } = render(<TrendChart clicksByDay={days(7, { 0: 3, 6: 1 })} />);

    expect(container.innerHTML).not.toContain('style=');
  });
});
