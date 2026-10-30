import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, '../styles.css'), 'utf8');

// Mínimo de WCAG AA para texto normal.
const MIN_CONTRAST = 4.5;

// Texto y fondo de cada combinación que usa la interfaz.
const PAIRS = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'notice-bg'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['accent-text', 'accent'],
  ['danger', 'bg'],
  ['danger', 'surface'],
  ['danger-text', 'danger'],
] as const;

function colorTokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name, value]) => [name, value]));
}

function rootBlock(source: string): string {
  const block = /:root\s*\{([^}]*)\}/.exec(source)?.[1];
  if (block === undefined) throw new Error('No hay bloque :root en styles.css');
  return block;
}

const light = colorTokens(rootBlock(css));
// El tema oscuro solo redefine colores: lo que no cambia se hereda del claro.
const dark = { ...light, ...colorTokens(rootBlock(css.slice(css.indexOf('prefers-color-scheme: dark')))) };

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

describe('colores del tema', () => {
  describe.each([
    ['claro', light],
    ['oscuro', dark],
  ])('tema %s', (_name, tokens) => {
    it.each(PAIRS)('--%s sobre --%s tiene contraste suficiente', (foreground, background) => {
      const fg = tokens[foreground];
      const bg = tokens[background];

      expect(fg, `falta --${foreground}`).toBeDefined();
      expect(bg, `falta --${background}`).toBeDefined();
      expect(contrast(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(MIN_CONTRAST);
    });
  });
});
