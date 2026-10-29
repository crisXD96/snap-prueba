import type { Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

export interface AuthUser {
  id: number;
  email: string;
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

export function createAuthMiddleware(jwtSecret: string): RequestHandler {
  return (req, res, next) => {
    const token = BEARER_PATTERN.exec(req.get('authorization') ?? '')?.[1];
    if (token === undefined) {
      rejectUnauthorized(res, 'Token requerido');
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
    if (typeof payload === 'string' || !USER_ID_PATTERN.test(payload.sub ?? '') || typeof payload.email !== 'string') {
      rejectUnauthorized(res, 'Token inválido o expirado');
      return;
    }

    req.user = { id: Number(payload.sub), email: payload.email };
    next();
  };
}
