import type { ErrorRequestHandler } from 'express';

const UNEXPECTED_ERROR = 'Ocurrió un error inesperado. Intenta de nuevo.';
const INVALID_REQUEST = 'La petición no es válida';

// Express marca con un status 4xx los errores que causó la petición, como el JSON mal formado.
function clientErrorStatus(error: unknown): number | undefined {
  const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

// Sin él, Express responde con HTML y, fuera de producción, con el stack del servidor.
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  // Si la respuesta ya empezó solo queda cortar la conexión, y eso lo hace el de Express.
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = clientErrorStatus(error);
  if (status !== undefined) {
    res.status(status).json({ error: INVALID_REQUEST });
    return;
  }
  console.error('Error no controlado', error);
  res.status(500).json({ error: UNEXPECTED_ERROR });
};
