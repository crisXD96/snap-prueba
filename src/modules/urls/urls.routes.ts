import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { getAuthUser } from '../auth/auth.middleware.ts';
import { createClicksRepository } from '../clicks/clicks.repository.ts';
import { createUrlsRepository } from './urls.repository.ts';
import {
  createUrlsService,
  InvalidUrlError,
  isShortCode,
  NotUrlOwnerError,
  UrlNotFoundError,
} from './urls.service.ts';

// requireAuth llega desde fuera para que este módulo no conozca el secreto del JWT.
export function createUrlsRouter(db: DatabaseSync, requireAuth: RequestHandler): Router {
  const service = createUrlsService(createUrlsRepository(db), createClicksRepository(db));
  const router = Router();

  router.post('/urls', requireAuth, (req, res) => {
    try {
      const { code, url } = service.shorten(req.body?.url, getAuthUser(req).id);
      res.status(201).json({ code, url });
    } catch (error) {
      if (!(error instanceof InvalidUrlError)) throw error;
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/urls/:code', requireAuth, (req, res) => {
    const { code } = req.params;
    // Con requireAuth delante, Express tipa los params de forma genérica y no asegura un string.
    if (typeof code !== 'string') {
      res.status(404).json({ error: 'Código no encontrado' });
      return;
    }
    try {
      service.remove(code, getAuthUser(req).id);
      res.status(204).end();
    } catch (error) {
      if (error instanceof UrlNotFoundError) {
        res.status(404).json({ error: error.message });
      } else if (error instanceof NotUrlOwnerError) {
        res.status(403).json({ error: error.message });
      } else {
        throw error;
      }
    }
  });

  // Solo atiende códigos con formato válido para no tapar rutas montadas después.
  router.get('/:code', (req, res, next) => {
    const { code } = req.params;
    if (!isShortCode(code)) {
      next();
      return;
    }
    const url = service.resolve(code, { referrer: req.get('referer'), userAgent: req.get('user-agent') });
    if (url === undefined) {
      res.status(404).json({ error: 'Código no encontrado' });
      return;
    }
    res.redirect(302, url);
  });

  return router;
}
