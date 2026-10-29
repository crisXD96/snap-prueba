import express, { Router } from 'express';

// La carpeta llega desde fuera para que los tests sirvan una propia sin depender del build.
export function createWebRouter(dir: string): Router {
  const router = Router();
  router.use(express.static(dir));
  return router;
}
