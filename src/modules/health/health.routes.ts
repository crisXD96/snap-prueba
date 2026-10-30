import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';

// No exige las tablas: el servidor está sano aunque el DBA aún no haya aplicado los scripts.
export function createHealthRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('La base no responde', error);
      res.status(503).json({ status: 'error' });
    }
  });

  return router;
}
