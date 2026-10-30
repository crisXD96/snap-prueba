import { Router } from 'express';
import type { RequestHandler, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { createAuthMiddleware, getAuthUser } from './auth.middleware.ts';
import { createUsersRepository } from './auth.repository.ts';
import {
  createAuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  normalizeEmail,
  ValidationError,
} from './auth.service.ts';
import { createLoginLimiter } from './login-limiter.ts';
import type { LoginLimiter } from './login-limiter.ts';
import { clearSessionCookie, isSameOrigin, setSessionCookie } from './session-cookie.ts';

// Estas rutas crean o borran la cookie de sesión: solo se aceptan desde la propia app.
const sameOriginOnly: RequestHandler = (req, res, next) => {
  if (isSameOrigin(req)) {
    next();
  } else {
    res.status(403).json({ error: 'Origen no permitido' });
  }
};

// Errores esperados del servicio a su código HTTP; cualquier otro sigue como 500.
function sendAuthError(error: unknown, res: Response): void {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
  } else if (error instanceof EmailAlreadyRegisteredError) {
    res.status(409).json({ error: error.message });
  } else if (error instanceof InvalidCredentialsError) {
    res.status(401).json({ error: error.message });
  } else {
    throw error;
  }
}

// IP y email juntos: frena probar passwords contra una cuenta sin bloquear a toda una red que
// comparte IP. Sin trust proxy, req.ip es la de la conexión directa (ver README).
function loginKey(ip: string | undefined, email: unknown): string {
  return `${ip ?? ''}|${typeof email === 'string' ? normalizeEmail(email) : ''}`;
}

export function createAuthRouter(
  db: DatabaseSync,
  jwtSecret: string,
  limiter: LoginLimiter = createLoginLimiter(),
): Router {
  const service = createAuthService(createUsersRepository(db), jwtSecret);
  const requireAuth = createAuthMiddleware(jwtSecret);
  const router = Router();

  // El token sigue en el body para los clientes de la API; la SPA usa solo la cookie.
  router.post('/auth/register', sameOriginOnly, async (req, res) => {
    try {
      const result = await service.register({
        email: req.body?.email,
        password: req.body?.password,
        name: req.body?.name,
      });
      setSessionCookie(res, result.token, result.expiresAt);
      res.status(201).json(result);
    } catch (error) {
      sendAuthError(error, res);
    }
  });

  // Con qué sesión arranca la SPA al recargar: la cookie viaja sola y el token no se expone.
  router.get('/auth/me', requireAuth, (req, res) => {
    const { id, expiresAt } = getAuthUser(req);
    const user = service.findUser(id);
    if (!user) {
      clearSessionCookie(res);
      res.status(401).json({ error: 'Token inválido o expirado' });
      return;
    }
    res.status(200).json({ user, expiresAt });
  });

  router.post('/auth/logout', sameOriginOnly, (_req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.post('/auth/login', sameOriginOnly, async (req, res) => {
    const key = loginKey(req.ip, req.body?.email);
    const retryAfter = limiter.retryAfter(key);
    if (retryAfter !== undefined) {
      res
        .status(429)
        .set('Retry-After', String(retryAfter))
        .json({ error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(retryAfter / 60)} min.` });
      return;
    }
    try {
      const result = await service.login(req.body?.email, req.body?.password);
      limiter.reset(key);
      setSessionCookie(res, result.token, result.expiresAt);
      res.status(200).json(result);
    } catch (error) {
      // Solo cuenta un password incorrecto: un body incompleto no sirve para adivinar nada.
      if (error instanceof InvalidCredentialsError) limiter.recordFailure(key);
      sendAuthError(error, res);
    }
  });

  return router;
}
