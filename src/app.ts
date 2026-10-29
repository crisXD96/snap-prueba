import express from 'express';
import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { createAuthMiddleware } from './modules/auth/auth.middleware.ts';
import { createAuthRouter } from './modules/auth/auth.routes.ts';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.ts';
import { healthRouter } from './modules/health/health.routes.ts';
import { createUrlsRouter } from './modules/urls/urls.routes.ts';
import { createWebRouter } from './modules/web/web.routes.ts';

// Separada de server.ts para que los tests levanten la app sin fijar un puerto.
// La conexión y el secreto llegan desde fuera para que los tests usen los suyos.
// Sin webDir no se sirve la SPA: los tests de la API no dependen del build.
export function createApp(db: DatabaseSync, jwtSecret: string, webDir?: string): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(createAuthRouter(db, jwtSecret));
  const requireAuth = createAuthMiddleware(jwtSecret);
  app.use(createDashboardRouter(db, requireAuth));
  app.use(createUrlsRouter(db, requireAuth));
  // Al final: la API tiene prioridad y las redirecciones no pasan por el disco.
  if (webDir !== undefined) {
    app.use(createWebRouter(webDir));
  }
  return app;
}
