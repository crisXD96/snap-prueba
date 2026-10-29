import { describe, expect, it } from 'vitest';
import { formatChange, formatDateTime, formatDay, shortUrl } from '../format.ts';

describe('formato', () => {
  it('arma la URL corta con el origen de la SPA', () => {
    expect(shortUrl('aB3xK9z', 'https://snap.example')).toBe('https://snap.example/aB3xK9z');
  });

  it('muestra el cambio porcentual con signo y avisa cuando no hay con qué comparar', () => {
    expect(formatChange(45)).toBe('+45 %');
    expect(formatChange(-12.5)).toBe('-12.5 %');
    expect(formatChange(0)).toBe('0 %');
    expect(formatChange(null)).toBe('Sin clicks en el periodo anterior');
  });

  it('muestra las fechas en la hora del centro de México', () => {
    // 05:00 UTC son las 23:00 del día anterior en UTC-6.
    expect(formatDateTime('2026-10-29T05:00:00.000Z')).toMatch(/28 oct/);
    expect(formatDateTime(null)).toBe('Nunca');
  });

  it('no corre de día las fechas que ya llegan en hora local', () => {
    expect(formatDay('2026-10-23')).toMatch(/^23 oct/);
  });
});
