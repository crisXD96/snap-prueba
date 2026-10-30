import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { openDatabase } from './shared/db.ts';

const port = Number(process.env.PORT ?? 3000);
// src/ y dist/ están al mismo nivel: la ruta sirve tanto en desarrollo como compilado.
const webDir = fileURLToPath(new URL('../dist/web', import.meta.url));
// Si una petición no termina, no se espera más que esto para salir.
const SHUTDOWN_TIMEOUT_MS = 10_000;

// Sin secreto no se puede firmar ni verificar ningún token: mejor no arrancar.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

const db = openDatabase();
const server = createApp(db, jwtSecret, webDir).listen(port, () => {
  console.log(`Snap escuchando en http://localhost:${port}`);
});

// Deja terminar las peticiones en curso y cierra la base: con WAL, cerrar la última conexión
// pasa snap.db-wal al archivo principal.
function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} recibido: cerrando Snap`);
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
