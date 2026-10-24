// Capa de acceso a datos de Recurso: solo SQL, sin reglas de negocio.
import { pool, escaparLike, sinTildesSql } from '../../db.js';
import { normalizarBusqueda } from '../../../compartido/texto.js';

const COLUMNAS = 'id, nombre, tipo, capacidad_maxima, estado, creado_en, actualizado_en';

function aRecurso(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    capacidadMaxima: fila.capacidad_maxima,
    estado: fila.estado,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

// La búsqueda por nombre no distingue mayúsculas ni tildes ("saúna" encuentra "Sauna seca").
export async function listar({ buscar, tipo, estado, limite, desde }) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS}
       FROM recurso
      WHERE ($1::text IS NULL OR ${sinTildesSql('nombre')} LIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR tipo = $2)
        AND ($3::text IS NULL OR estado = $3)
      ORDER BY nombre, id
      LIMIT $4 OFFSET $5`,
    [buscar ? escaparLike(normalizarBusqueda(buscar)) : null, tipo, estado, limite + 1, desde],
  );
  return { datos: rows.slice(0, limite).map(aRecurso), hayMas: rows.length > limite };
}

export async function obtener(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM recurso WHERE id = $1`, [id]);
  return rows[0] ? aRecurso(rows[0]) : null;
}

export async function crear({ nombre, tipo, capacidadMaxima, estado }) {
  const { rows } = await pool.query(
    `INSERT INTO recurso (nombre, tipo, capacidad_maxima, estado)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNAS}`,
    [nombre, tipo, capacidadMaxima, estado],
  );
  return aRecurso(rows[0]);
}

export async function actualizar(id, { nombre, tipo, capacidadMaxima, estado }) {
  const { rows } = await pool.query(
    `UPDATE recurso
        SET nombre = $2, tipo = $3, capacidad_maxima = $4, estado = $5, actualizado_en = now()
      WHERE id = $1
  RETURNING ${COLUMNAS}`,
    [id, nombre, tipo, capacidadMaxima, estado],
  );
  return rows[0] ? aRecurso(rows[0]) : null;
}

export async function eliminar(id) {
  const { rowCount } = await pool.query('DELETE FROM recurso WHERE id = $1', [id]);
  return rowCount === 1;
}
