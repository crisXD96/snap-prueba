import { Router } from 'express';
import type { Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { createUsersRepository } from './auth.repository.ts';
import {
  createAuthService,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  ValidationError,
} from './auth.service.ts';

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

export function createAuthRouter(db: DatabaseSync, jwtSecret: string): Router {
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
    try {
      const result = await service.login(req.body?.email, req.body?.password);
      res.status(200).json(result);
    } catch (error) {
      sendAuthError(error, res);
    }
  });

  return router;
}
