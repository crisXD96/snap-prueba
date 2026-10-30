import type { RequestHandler } from 'express';

// Estricta porque la SPA no usa scripts ni estilos inline: ni siquiera atributos style
// (ver .claude/rules/desing.md). Si alguno vuelve, esta política lo bloquea en el navegador.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  // frame-ancestors lo cubre en navegadores actuales; este es para los que no lo entienden.
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set(SECURITY_HEADERS);
  next();
};
