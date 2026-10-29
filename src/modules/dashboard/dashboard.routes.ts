import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { getAuthUser } from '../auth/auth.middleware.ts';
import { createDashboardRepository } from './dashboard.repository.ts';
import { createDashboardService, InvalidDashboardQueryError } from './dashboard.service.ts';

// requireAuth llega desde fuera para que este módulo no conozca el secreto del JWT.
export function createDashboardRouter(db: DatabaseSync, requireAuth: RequestHandler): Router {
  const service = createDashboardService(createDashboardRepository(db));
  const router = Router();

  router.get('/dashboard', requireAuth, (req, res) => {
    try {
      const overview = service.getOverview(getAuthUser(req).id, { days: req.query.days, cursor: req.query.cursor });
      res.status(200).json(overview);
    } catch (error) {
      if (!(error instanceof InvalidDashboardQueryError)) throw error;
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
