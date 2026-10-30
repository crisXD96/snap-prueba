import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'snap_session';

// HttpOnly: el JavaScript de la página no puede leerla, así que un XSS no se lleva el token.
// SameSite=Strict: el navegador no la manda en peticiones que empiezan en otro sitio.
// Secure: solo viaja por HTTPS; los navegadores la aceptan también en http://localhost.
const OPTIONS: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };

export function setSessionCookie(res: Response, token: string, expiresAt: string): void {
  res.cookie(SESSION_COOKIE, token, { ...OPTIONS, maxAge: Date.parse(expiresAt) - Date.now() });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, OPTIONS);
}

// Sin cookie-parser: solo hace falta esta cookie y el formato del header es simple.
export function readSessionCookie(req: Request): string | undefined {
  for (const pair of (req.get('cookie') ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (pair.slice(0, separator).trim() === SESSION_COOKIE) {
      return pair.slice(separator + 1).trim() || undefined;
    }
  }
  return undefined;
}

// Defensa contra CSRF además de SameSite: una petición con efectos que trae Origin debe venir
// de este mismo host. Sin Origin no es un navegador haciendo una petición entre sitios.
export function isSameOrigin(req: Request): boolean {
  const origin = req.get('origin');
  return origin === undefined || URL.parse(origin)?.host === req.get('host');
}
