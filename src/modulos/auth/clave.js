// Contraseñas: se guardan como "hash" con scrypt (función de Node, sin dependencias). Cada contraseña
// lleva su propia sal aleatoria, así dos personas con la misma contraseña tienen hashes distintos, y el
// hash es lento a propósito para que adivinar contraseñas por fuerza bruta sea impracticable.
// Formato guardado: scrypt$N$r$p$sal$hash (todo en una sola columna de texto).
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const LARGO = 64;
const MINIMO_CARACTERES = 8;

function derivar(clave, sal, n = N, r = R, p = P) {
  return new Promise((resolver, rechazar) => {
    scrypt(clave, sal, LARGO, { N: n, r, p }, (err, llave) => (err ? rechazar(err) : resolver(llave)));
  });
}

// Mensaje para el usuario si la contraseña no cumple las reglas, o null si es válida.
export function problemaDeClave(clave) {
  if (typeof clave !== 'string' || clave.length < MINIMO_CARACTERES) {
    return `La contraseña debe tener al menos ${MINIMO_CARACTERES} caracteres.`;
  }
  if (clave.length > 200) return 'La contraseña es demasiado larga.';
  return null;
}

export async function hashear(clave) {
  const sal = randomBytes(16);
  const llave = await derivar(clave, sal);
  return `scrypt$${N}$${R}$${P}$${sal.toString('hex')}$${llave.toString('hex')}`;
}

// Compara una contraseña con un hash guardado, en tiempo constante.
export async function verificar(clave, guardado) {
  const partes = typeof guardado === 'string' ? guardado.split('$') : [];
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, salHex, hashHex] = partes;
  const esperado = Buffer.from(hashHex, 'hex');
  const obtenido = await derivar(clave, Buffer.from(salHex, 'hex'), Number(n), Number(r), Number(p));
  return esperado.length === obtenido.length && timingSafeEqual(esperado, obtenido);
}

// Hash de una contraseña inventada. Cuando el correo no existe se compara contra este, para que
// la respuesta tarde lo mismo y no se pueda descubrir qué correos están registrados.
export const HASH_FALSO = await hashear(randomBytes(16).toString('hex'));
