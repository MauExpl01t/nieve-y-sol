// Capa de acceso a datos de usuarios y sesiones: solo SQL, sin reglas de negocio.
import { createHash } from 'node:crypto';
import { pool } from '../../db.js';

// El token que viaja en la cookie nunca se guarda: se guarda su SHA-256.
export const hashDeToken = (token) => createHash('sha256').update(token).digest('hex');

export async function buscarUsuarioPorCorreo(correo) {
  const { rows } = await pool.query(
    'SELECT id, nombre, correo, rol, estado, password_hash FROM usuario WHERE correo = $1',
    [correo],
  );
  return rows[0] ?? null;
}

export async function crearUsuario({ nombre, correo, passwordHash, rol }) {
  const { rows } = await pool.query(
    `INSERT INTO usuario (nombre, correo, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, correo, rol`,
    [nombre, correo, passwordHash, rol],
  );
  return rows[0];
}

export async function crearSesion({ token, usuarioId, duracionHoras }) {
  await pool.query(
    `INSERT INTO sesion (token_hash, usuario_id, expira_en)
     VALUES ($1, $2, now() + make_interval(hours => $3::int))`,
    [hashDeToken(token), usuarioId, duracionHoras],
  );
}

// La persona de una sesión vigente (no vencida, y con el usuario activo), o null.
export async function buscarSesion(token) {
  const { rows } = await pool.query(
    `SELECT u.id, u.nombre, u.correo, u.rol
       FROM sesion s
       JOIN usuario u ON u.id = s.usuario_id
      WHERE s.token_hash = $1 AND s.expira_en > now() AND u.estado = 'activo'`,
    [hashDeToken(token)],
  );
  return rows[0] ?? null;
}

export async function borrarSesion(token) {
  await pool.query('DELETE FROM sesion WHERE token_hash = $1', [hashDeToken(token)]);
}

export async function borrarSesionesVencidas() {
  await pool.query('DELETE FROM sesion WHERE expira_en <= now()');
}
