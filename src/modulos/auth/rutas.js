// Rutas HTTP de autenticación:
//   POST /api/auth/login   { correo, password }  abre la sesión (cookie "sid")
//   POST /api/auth/logout                         cierra la sesión
//   GET  /api/auth/yo                             quién es la persona con sesión abierta
import { Router } from 'express';
import * as servicio from './servicio.js';
import { NOMBRE_COOKIE, opcionesCookie } from './middleware.js';
import { ErrorApp, metodoNoPermitido } from '../../errores.js';
import { lanzarSiHayErrores } from '../../validaciones.js';

export const rutasAuth = Router();

rutasAuth.post('/login', async (req, res) => {
  const entrada = req.body ?? {};
  const errores = {};
  const correo = typeof entrada.correo === 'string' ? entrada.correo.trim().toLowerCase() : '';
  if (correo === '') errores.correo = 'Escribe tu correo.';
  if (typeof entrada.password !== 'string' || entrada.password === '') errores.password = 'Escribe tu contraseña.';
  else if (entrada.password.length > 200) errores.password = 'La contraseña es demasiado larga.';
  lanzarSiHayErrores(errores);

  const { token, usuario } = await servicio.iniciarSesion({ correo, password: entrada.password, ip: req.ip });
  res.cookie(NOMBRE_COOKIE, token, opcionesCookie(req, servicio.DURACION_SESION_HORAS * 60 * 60 * 1000));
  res.json({ usuario });
});
rutasAuth.all('/login', metodoNoPermitido('POST'));

rutasAuth.post('/logout', async (req, res) => {
  if (req.token) await servicio.cerrarSesion(req.token);
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie(req, undefined));
  res.status(204).end();
});
rutasAuth.all('/logout', metodoNoPermitido('POST'));

rutasAuth.get('/yo', (req, res) => {
  if (!req.usuario) throw new ErrorApp(401, 'NO_AUTENTICADO', 'Inicia sesión para continuar.');
  res.json({ usuario: req.usuario });
});
rutasAuth.all('/yo', metodoNoPermitido('GET'));
