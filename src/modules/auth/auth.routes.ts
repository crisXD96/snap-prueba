import { Router } from 'express';
import type { Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
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
  const router = Router();

  router.post('/auth/register', async (req, res) => {
    try {
      const result = await service.register({
        email: req.body?.email,
        password: req.body?.password,
        name: req.body?.name,
      });
      res.status(201).json(result);
    } catch (error) {
      sendAuthError(error, res);
    }
  });

  router.post('/auth/login', async (req, res) => {
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
      res.status(200).json(result);
    } catch (error) {
      // Solo cuenta un password incorrecto: un body incompleto no sirve para adivinar nada.
      if (error instanceof InvalidCredentialsError) limiter.recordFailure(key);
      sendAuthError(error, res);
    }
  });

  return router;
}
