import express from 'express';
import type { Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { createAuthMiddleware } from './modules/auth/auth.middleware.ts';
import { createAuthRouter } from './modules/auth/auth.routes.ts';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.ts';
import { createHealthRouter } from './modules/health/health.routes.ts';
import { createUrlsRouter } from './modules/urls/urls.routes.ts';
import { createWebRouter } from './modules/web/web.routes.ts';
import { errorHandler } from './shared/error.middleware.ts';
import { securityHeaders } from './shared/security-headers.middleware.ts';

// Separada de server.ts para que los tests levanten la app sin fijar un puerto.
// La conexión y el secreto llegan desde fuera para que los tests usen los suyos.
// Sin webDir no se sirve la SPA: los tests de la API no dependen del build.
export function createApp(db: DatabaseSync, jwtSecret: string, webDir?: string): Express {
  const app = express();
  app.disable('x-powered-by');
  // Primero, para que también los lleven las respuestas de error y las redirecciones.
  app.use(securityHeaders);
  app.use(express.json());
  app.use(createHealthRouter(db));
  app.use(createAuthRouter(db, jwtSecret));
  const requireAuth = createAuthMiddleware(jwtSecret);
  app.use(createDashboardRouter(db, requireAuth));
  app.use(createUrlsRouter(db, requireAuth));
  // Al final: la API tiene prioridad y las redirecciones no pasan por el disco.
  if (webDir !== undefined) {
    app.use(createWebRouter(webDir));
  }
  app.use(errorHandler);
  return app;
}
