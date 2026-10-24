// Conexión a PostgreSQL. Todo el acceso a datos pasa por este pool.
import pg from 'pg';
import { log, datosError } from './log.js';
import { CON_TILDES, SIN_TILDES } from '../compartido/texto.js';

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL. Copia .env.example como .env y complétalo.');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000, // si la BD no responde en 5 s, se falla en vez de quedar colgado
  statement_timeout: 5000,
});

pool.on('error', (err) => {
  log('error', 'Error inesperado en una conexión de PostgreSQL', datosError(err));
});

// Escapa % y _ para que la búsqueda del usuario se tome como texto literal en LIKE/ILIKE.
export function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, '\\$&');
}

// Expresión SQL que deja una columna en minúsculas y sin tildes. Se compara con
// normalizarBusqueda(texto) de compartido/texto.js, que hace lo mismo en JavaScript:
//   WHERE ${sinTildesSql('nombre')} LIKE '%' || $1 || '%'
export function sinTildesSql(columna) {
  return `lower(translate(${columna}, '${CON_TILDES}', '${SIN_TILDES}'))`;
}

// Ejecuta varias consultas como una sola transacción: o se guardan todas o ninguna.
// tarea recibe una conexión propia (db) y debe usarla para todas sus consultas.
export async function conTransaccion(tarea) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const resultado = await tarea(db);
    await db.query('COMMIT');
    return resultado;
  } catch (err) {
    await db.query('ROLLBACK').catch((errRollback) => {
      log('error', 'No se pudo deshacer la transacción', datosError(errRollback));
    });
    throw err;
  } finally {
    db.release();
  }
}
