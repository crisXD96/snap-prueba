import type { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import { isSameOrigin, readSessionCookie } from './session-cookie.ts';

export interface AuthUser {
  id: number;
  email: string;
  // Cuándo vence el token, para que la SPA cierre la sesión a tiempo sin poder leer la cookie.
  expiresAt: string;
}

declare global {
  namespace Express {
    interface Request {
      // Solo existe después de pasar por el middleware de autenticación.
      user?: AuthUser;
    }
  }
}

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;
const USER_ID_PATTERN = /^[1-9]\d*$/;

// Para rutas protegidas: si falta el usuario, la ruta se montó sin el middleware.
export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new Error('La ruta no pasó por el middleware de autenticación');
  }
  return req.user;
}

function rejectUnauthorized(res: Response, message: string): void {
  res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: message });
}

// Leer o consultar no cambia nada: solo las peticiones con efectos necesitan defensa contra CSRF.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// El header Authorization (clientes de la API) tiene prioridad sobre la cookie (la SPA).
export function createAuthMiddleware(jwtSecret: string): RequestHandler {
  return (req, res, next) => {
    const bearer = BEARER_PATTERN.exec(req.get('authorization') ?? '')?.[1];
    const token = bearer ?? readSessionCookie(req);
    if (token === undefined) {
      rejectUnauthorized(res, 'Token requerido');
      return;
    }
    // Un sitio ajeno no puede poner el header Authorization, pero el navegador sí podría adjuntar
    // la cookie: solo la sesión por cookie necesita comprobar el origen.
    if (bearer === undefined && !SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
      res.status(403).json({ error: 'Origen no permitido' });
      return;
    }

    let payload: string | JwtPayload;
    try {
      // El algoritmo se fija para que un token no pueda elegir cómo se verifica.
      payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch {
      rejectUnauthorized(res, 'Token inválido o expirado');
      return;
    }

    // Firma válida no basta: el token debe traer lo que emite el servicio de auth.
    if (
      typeof payload === 'string' ||
      !USER_ID_PATTERN.test(payload.sub ?? '') ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      rejectUnauthorized(res, 'Token inválido o expirado');
      return;
    }

    req.user = { id: Number(payload.sub), email: payload.email, expiresAt: new Date(payload.exp * 1000).toISOString() };
    next();
  };
}
