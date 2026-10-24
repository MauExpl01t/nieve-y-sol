// Punto de entrada: levanta el servidor web.
import { crearApp } from './app.js';
import { pool } from './db.js';
import { log, datosError } from './log.js';

const puerto = Number(process.env.PORT) || 3000;
const servidor = crearApp().listen(puerto, () => {
  log('info', `Servidor listo en http://localhost:${puerto}`);
});

servidor.on('error', (err) => {
  log('error', 'No se pudo iniciar el servidor', datosError(err));
  process.exit(1);
});

// Cierre ordenado (Ctrl+C): termina las peticiones en curso y cierra las conexiones a la BD.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    servidor.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
