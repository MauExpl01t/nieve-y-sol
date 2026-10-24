// Acceso a datos de Servicio. Por ahora solo consulta: el catálogo se carga con db/seed.sql.
import { pool } from '../../db.js';

// recurso_ids: los recursos que pueden atender el servicio (tabla servicio_recurso).
const CONSULTA = `
  SELECT s.id, s.nombre, s.duracion_min, s.precio, s.activo,
         COALESCE(array_agg(sr.recurso_id::text ORDER BY sr.recurso_id)
                  FILTER (WHERE sr.recurso_id IS NOT NULL), '{}'::text[]) AS recurso_ids
    FROM servicio s
    LEFT JOIN servicio_recurso sr ON sr.servicio_id = s.id`;

function aServicio(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    duracionMin: fila.duracion_min,
    precio: fila.precio,
    activo: fila.activo,
    recursoIds: fila.recurso_ids,
  };
}

export async function listarActivos() {
  const { rows } = await pool.query(`${CONSULTA} WHERE s.activo GROUP BY s.id ORDER BY s.nombre LIMIT 200`);
  return rows.map(aServicio);
}

export async function obtener(id, db = pool) {
  const { rows } = await db.query(`${CONSULTA} WHERE s.id = $1 GROUP BY s.id`, [id]);
  return rows[0] ? aServicio(rows[0]) : null;
}
