// Capa de acceso a datos de Cliente: solo SQL, sin reglas de negocio.
// Todas las consultas usan parámetros ($1, $2...), nunca texto concatenado: evita inyección SQL.
import { pool, escaparLike, sinTildesSql } from '../../db.js';
import { normalizarBusqueda } from '../../../compartido/texto.js';

// Columnas que se devuelven. password_hash nunca sale de la base de datos.
const COLUMNAS = `id, nombre, rut, estado, version, (password_hash IS NOT NULL) AS tiene_cuenta_web,
                  creado_en, actualizado_en`;

function aCliente(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rut: fila.rut,
    estado: fila.estado,
    version: fila.version,
    tieneCuentaWeb: fila.tiene_cuenta_web,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

// Busca por nombre (en cualquier parte, sin distinguir mayúsculas ni tildes) o por RUT
// (desde el inicio, con o sin puntos y guion). "estado" filtra por activo / inactivo.
export async function listar({ buscar, estado, limite, desde }) {
  const nombre = buscar ? escaparLike(normalizarBusqueda(buscar)) : null;
  const rut = buscar ? escaparLike(buscar.replace(/[.\s-]/g, '').toUpperCase()) : '';
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS}
       FROM cliente
      WHERE ($5::text IS NULL OR estado = $5)
        AND ($1::text IS NULL
             OR ${sinTildesSql('nombre')} LIKE '%' || $1 || '%'
             OR ($2::text <> '' AND replace(rut, '-', '') LIKE $2 || '%'))
      ORDER BY nombre, id
      LIMIT $3 OFFSET $4`,
    [nombre, rut, limite + 1, desde, estado], // se pide uno extra para saber si hay más resultados
  );
  return { datos: rows.slice(0, limite).map(aCliente), hayMas: rows.length > limite };
}

export async function obtener(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM cliente WHERE id = $1`, [id]);
  return rows[0] ? aCliente(rows[0]) : null;
}

export async function crear({ nombre, rut, estado }) {
  const { rows } = await pool.query(
    `INSERT INTO cliente (nombre, rut, estado) VALUES ($1, $2, $3) RETURNING ${COLUMNAS}`,
    [nombre, rut, estado],
  );
  return aCliente(rows[0]);
}

// Si viene "version", solo actualiza cuando coincide con la que vio quien edita. Devuelve null si el
// cliente no existe o si alguien lo modificó antes (el servicio distingue cuál de los dos).
export async function actualizar(id, { nombre, rut, estado, version = null }) {
  const { rows } = await pool.query(
    `UPDATE cliente
        SET nombre = $2, rut = $3, estado = $4, version = version + 1, actualizado_en = now()
      WHERE id = $1 AND ($5::int IS NULL OR version = $5::int)
  RETURNING ${COLUMNAS}`,
    [id, nombre, rut, estado, version],
  );
  return rows[0] ? aCliente(rows[0]) : null;
}

export async function eliminar(id) {
  const { rowCount } = await pool.query('DELETE FROM cliente WHERE id = $1', [id]);
  return rowCount === 1;
}
