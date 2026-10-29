// El dashboard del backend agrupa los días en el centro de México (UTC-6 fijo, sin horario de verano).
const TIME_ZONE = 'America/Mexico_City';

const dateTimeFormat = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE });
// Los días ya llegan como fecha local (YYYY-MM-DD): se leen en UTC para no correrlos de día.
const dayFormat = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('es-MX');
const percentFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });

export function shortUrl(code: string, origin: string = window.location.origin): string {
  return `${origin}/${code}`;
}

export function formatDateTime(iso: string | null): string {
  return iso === null ? 'Nunca' : dateTimeFormat.format(new Date(iso));
}

export function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatChange(changePercent: number | null): string {
  return changePercent === null ? 'Sin clicks en el periodo anterior' : `${percentFormat.format(changePercent)} %`;
}
