// Configuración de Express: middlewares, rutas de la API y archivos del frontend.
import express from 'express';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { log, datosError } from './log.js';
import { ErrorApp, manejadorErrores } from './errores.js';
import { rutasClientes } from './modulos/clientes/rutas.js';
import { rutasRecursos } from './modulos/recursos/rutas.js';
import { rutasServicios } from './modulos/servicios/rutas.js';
import { rutasReservas, rutasDisponibilidad } from './modulos/reservas/rutas.js';
import { rutasAuth } from './modulos/auth/rutas.js';
import { cargarSesion, exigirSesion, exigirPermiso } from './modulos/auth/middleware.js';

const carpeta = (ruta) => fileURLToPath(new URL(ruta, import.meta.url));

export function crearApp() {
  const app = express();
  app.disable('x-powered-by'); // no revelar qué framework usamos

  // Cabeceras de seguridad básicas (RNF-03).
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    next();
  });

  // Una línea de log por petición a la API, con un id para rastrearla.
  // No se registran cuerpos ni búsquedas, porque pueden contener RUT o nombres.
  app.use((req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-Id', req.id);
    const inicio = process.hrtime.bigint();
    res.on('finish', () => {
      if (!req.originalUrl.startsWith('/api/')) return;
      log('info', 'peticion', {
        requestId: req.id,
        metodo: req.method,
        ruta: req.originalUrl.split('?')[0],
        estado: res.statusCode,
        ms: Number((process.hrtime.bigint() - inicio) / 1_000_000n),
      });
    });
    next();
  });

  app.use(express.json({ limit: '10kb' }));

  // Chequeo de salud: confirma que la API responde Y que la base de datos está disponible.
  app.get('/api/salud', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ estado: 'ok' });
    } catch (err) {
      log('error', 'La base de datos no responde', { requestId: req.id, ...datosError(err) });
      res.status(503).json({ estado: 'sin_base_de_datos' });
    }
  });

  // Autenticación (RF-08, RNF-03). /api/salud y /api/auth/login son públicos; todo lo demás exige una
  // sesión abierta, y cada módulo exige además el permiso del rol (compartido/permisos.js).
  app.use('/api', cargarSesion);
  app.use('/api/auth', rutasAuth);
  app.use('/api', exigirSesion);

  app.use('/api/clientes', exigirPermiso('clientes'), rutasClientes);
  app.use('/api/recursos', exigirPermiso('recursos'), rutasRecursos);
  app.use('/api/servicios', exigirPermiso('servicios'), rutasServicios);
  app.use('/api/reservas', exigirPermiso('reservas'), rutasReservas);
  app.use('/api/disponibilidad', exigirPermiso('disponibilidad'), rutasDisponibilidad);

  app.use('/api', () => {
    throw new ErrorApp(404, 'RUTA_NO_EXISTE', 'Esa ruta de la API no existe.');
  });

  // Frontend: la aplicación React ya compilada (npm run build genera la carpeta dist/).
  const frontend = carpeta('../dist');
  if (existsSync(frontend)) {
    app.use(express.static(frontend));
  } else {
    log('error', 'Falta compilar el frontend: ejecuta "npm run build" y vuelve a iniciar el servidor.');
    app.get('/', (req, res) => {
      res.status(503).type('text').send('Falta compilar el frontend. Ejecuta "npm run build" y vuelve a iniciar el servidor.');
    });
  }

  app.use(manejadorErrores);
  return app;
}
