// Middlewares de autenticación y permisos. Van antes de las rutas de cada módulo (ver src/app.js).
import * as servicio from './servicio.js';
import { ErrorApp } from '../../errores.js';
import { puede, ROLES } from '../../../compartido/permisos.js';

export const NOMBRE_COOKIE = 'sid';

// Lee una cookie de la cabecera, sin librerías.
function leerCookie(req, nombre) {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}

// Opciones de la cookie de sesión: no la puede leer JavaScript (HttpOnly), no viaja en peticiones
// que vienen de otros sitios (SameSite) y solo por HTTPS cuando el sitio se sirve por HTTPS.
export function opcionesCookie(req, maxAgeMs) {
  return { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/', maxAge: maxAgeMs };
}

// Deja en req.usuario a la persona de la sesión (o null) y en req.token su token.
export async function cargarSesion(req, res, next) {
  const token = leerCookie(req, NOMBRE_COOKIE);
  req.token = token;
  req.usuario = token ? await servicio.usuarioDeSesion(token) : null;
  next();
}

export function exigirSesion(req, res, next) {
  if (!req.usuario) throw new ErrorApp(401, 'NO_AUTENTICADO', 'Inicia sesión para continuar.');
  next();
}

// Exige el permiso del rol sobre un módulo: consultar para GET, modificar para el resto.
export function exigirPermiso(modulo) {
  return (req, res, next) => {
    const accion = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? 'leer' : 'escribir';
    if (!puede(req.usuario.rol, modulo, accion)) {
      const rol = ROLES[req.usuario.rol] ?? req.usuario.rol;
      throw new ErrorApp(
        403,
        'SIN_PERMISO',
        accion === 'leer'
          ? `Tu rol (${rol}) no puede consultar esta sección.`
          : `Tu rol (${rol}) no puede modificar esta sección.`,
      );
    }
    next();
  };
}
