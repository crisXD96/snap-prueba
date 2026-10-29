import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { openDatabase } from './shared/db.ts';

const port = Number(process.env.PORT ?? 3000);
// src/ y dist/ están al mismo nivel: la ruta sirve tanto en desarrollo como compilado.
const webDir = fileURLToPath(new URL('../dist/web', import.meta.url));

// Sin secreto no se puede firmar ni verificar ningún token: mejor no arrancar.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

createApp(openDatabase(), jwtSecret, webDir).listen(port, () => {
  console.log(`Snap escuchando en http://localhost:${port}`);
});
