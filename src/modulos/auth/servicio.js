// Capa de negocio del inicio de sesión: verifica credenciales, abre y cierra sesiones y frena los
// intentos repetidos de adivinar una contraseña.
import { randomBytes } from 'node:crypto';
import * as repositorio from './repositorio.js';
import { verificar, HASH_FALSO } from './clave.js';
import { ErrorApp } from '../../errores.js';

export const DURACION_SESION_HORAS = 8; // una jornada de trabajo

// Después de MAX_INTENTOS fallidos con el mismo correo desde el mismo computador, se bloquea por
// BLOQUEO_MS. Está en memoria: basta para frenar la adivinanza de contraseñas en un solo servidor.
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 10 * 60 * 1000;
const intentos = new Map(); // "ip|correo" -> { cuenta, desde }

function bloqueado(clave, ahora) {
  const registro = intentos.get(clave);
  if (!registro) return false;
  if (ahora - registro.desde > BLOQUEO_MS) {
    intentos.delete(clave);
    return false;
  }
  return registro.cuenta >= MAX_INTENTOS;
}

function registrarFallo(clave, ahora) {
  if (intentos.size > 1000) {
    for (const [k, v] of intentos) if (ahora - v.desde > BLOQUEO_MS) intentos.delete(k);
  }
  const registro = intentos.get(clave);
  if (!registro || ahora - registro.desde > BLOQUEO_MS) intentos.set(clave, { cuenta: 1, desde: ahora });
  else registro.cuenta += 1;
}

// Solo para las pruebas.
export function reiniciarLimites() {
  intentos.clear();
}

// Devuelve { token, usuario }. El token va en la cookie; en la base de datos solo queda su hash.
export async function iniciarSesion({ correo, password, ip }) {
  const clave = `${ip}|${correo}`;
  const ahora = Date.now();
  if (bloqueado(clave, ahora)) {
    throw new ErrorApp(
      429,
      'DEMASIADOS_INTENTOS',
      'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.',
    );
  }

  const usuario = await repositorio.buscarUsuarioPorCorreo(correo);
  // Se compara siempre, aunque el correo no exista: así no se nota por el tiempo de respuesta.
  const coincide = await verificar(password, usuario?.password_hash ?? HASH_FALSO);
  if (!usuario || !coincide || usuario.estado !== 'activo') {
    registrarFallo(clave, ahora);
    // El mismo mensaje para todo: no se revela si el correo existe o si la cuenta está inactiva.
    throw new ErrorApp(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
  }

  intentos.delete(clave);
  await repositorio.borrarSesionesVencidas();
  const token = randomBytes(32).toString('base64url');
  await repositorio.crearSesion({ token, usuarioId: usuario.id, duracionHoras: DURACION_SESION_HORAS });
  return {
    token,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
  };
}

export function usuarioDeSesion(token) {
  return repositorio.buscarSesion(token);
}

export function cerrarSesion(token) {
  return repositorio.borrarSesion(token);
}
