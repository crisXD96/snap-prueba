import { randomInt } from 'node:crypto';
import type { ClicksRepository } from '../clicks/clicks.repository.ts';
import type { UrlRecord, UrlsRepository } from './urls.repository.ts';

const CODE_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 7;
const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{7}$/;
// "nombre:" al inicio es un esquema, salvo que siga un número: "example.com:8080" es un puerto.
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
// Con 62^7 códigos posibles una colisión es rara; varias seguidas indican otro problema.
const MAX_ATTEMPTS = 5;
// Los encabezados los controla quien visita: sin tope, un solo click podría ocupar megas.
const MAX_HEADER_LENGTH = 512;

export class InvalidUrlError extends Error {}

export class CodeGenerationError extends Error {}

export class UrlNotFoundError extends Error {}

export class NotUrlOwnerError extends Error {}

// Encabezados de la petición que sigue el enlace corto, tal como llegan.
export interface Visit {
  referrer: string | undefined;
  userAgent: string | undefined;
}

export interface UrlsService {
  shorten(rawUrl: unknown, userId: number): UrlRecord;
  // Registra el click solo si el código existe.
  resolve(code: string, visit: Visit): string | undefined;
  remove(code: string, userId: number): void;
}

export function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
  }
  return code;
}

export function isShortCode(value: string): boolean {
  return SHORT_CODE_PATTERN.test(value);
}

function normalizeHttpUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') {
    throw new InvalidUrlError('El campo url es obligatorio');
  }
  const trimmed = rawUrl.trim();

  // Sin esquema se asume https, como hace el navegador con lo que se escribe en la barra.
  if (!SCHEME_PATTERN.test(trimmed)) {
    const url = `https://${trimmed}`;
    // Exigir un dominio con punto evita que cualquier palabra suelta pase como url.
    if (!URL.parse(url)?.hostname.includes('.')) {
      throw new InvalidUrlError('La url no es válida');
    }
    return url;
  }

  const parsed = URL.parse(trimmed);
  if (parsed === null || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    throw new InvalidUrlError('La url debe ser http o https');
  }
  return trimmed;
}

// Solo el origen: la ruta y la query del sitio que enlaza pueden traer tokens o datos personales.
function referrerOrigin(referrer: string | undefined): string | null {
  const origin = URL.parse(referrer ?? '')?.origin;
  // Los esquemas que no son web (android-app://...) tienen origen "null".
  return origin && origin !== 'null' ? origin.slice(0, MAX_HEADER_LENGTH) : null;
}

// nextCode es inyectable para poder forzar colisiones en los tests.
export function createUrlsService(
  repository: UrlsRepository,
  clicks: ClicksRepository,
  nextCode: () => string = generateCode,
): UrlsService {
  return {
    shorten(rawUrl, userId) {
      const url = normalizeHttpUrl(rawUrl);
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const record = repository.insert(nextCode(), url, userId);
        if (record) return record;
      }
      throw new CodeGenerationError(`No se encontró un código libre en ${MAX_ATTEMPTS} intentos`);
    },

    resolve(code, { referrer, userAgent }) {
      const record = repository.findByCode(code);
      if (!record) return undefined;
      try {
        clicks.record({
          code,
          referrer: referrerOrigin(referrer),
          userAgent: userAgent ? userAgent.slice(0, MAX_HEADER_LENGTH) : null,
        });
      } catch (error) {
        // Las analíticas nunca deben romper un enlace: se pierde el click, no la redirección.
        console.error('No se pudo registrar el click', error);
      }
      return record.url;
    },

    remove(code, userId) {
      const record = repository.findByCode(code);
      if (!record) {
        throw new UrlNotFoundError('Código no encontrado');
      }
      if (record.userId !== userId) {
        throw new NotUrlOwnerError('La url pertenece a otro usuario');
      }
      repository.delete(code);
    },
  };
}
