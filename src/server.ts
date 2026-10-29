import { createApp } from './app.ts';
import { openDatabase } from './shared/db.ts';

const port = Number(process.env.PORT ?? 3000);

// Sin secreto no se puede firmar ni verificar ningún token: mejor no arrancar.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('Falta la variable de entorno JWT_SECRET');
}

createApp(openDatabase(), jwtSecret).listen(port, () => {
  console.log(`Snap escuchando en http://localhost:${port}`);
});
