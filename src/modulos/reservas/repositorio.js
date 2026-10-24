// Capa de acceso a datos de Reserva: solo SQL, sin reglas de negocio.
// Las horas se guardan como instantes (timestamptz) y se convierten a la hora local del centro
// con AT TIME ZONE. Así "10:00" siempre es 10:00 en Chile, sin importar la zona del servidor.
import { pool, escaparLike, sinTildesSql } from '../../db.js';
import { ZONA_HORARIA } from '../../config.js';
import { ESTADOS_ACTIVOS, PLAZO_PAGO_MIN } from '../../../compartido/catalogos.js';
import { aMinutos } from '../../../compartido/horario.js';
import { normalizarBusqueda } from '../../../compartido/texto.js';

// $1 es siempre la zona horaria en las consultas que usan estas columnas.
const COLUMNAS = `
  r.id, r.estado, r.version, r.inicio, r.fin, r.cantidad_personas, r.creado_en, r.actualizado_en,
  to_char(r.inicio AT TIME ZONE $1::text, 'YYYY-MM-DD') AS fecha,
  to_char(r.inicio AT TIME ZONE $1::text, 'HH24:MI') AS hora_inicio,
  to_char(r.fin AT TIME ZONE $1::text, 'HH24:MI') AS hora_fin,
  c.id AS cliente_id, c.nombre AS cliente_nombre, c.rut AS cliente_rut,
  s.id AS servicio_id, s.nombre AS servicio_nombre, s.duracion_min, s.precio,
  rc.id AS recurso_id, rc.nombre AS recurso_nombre, rc.tipo AS recurso_tipo`;

const ORIGEN = `
  FROM reserva r
  JOIN cliente c ON c.id = r.cliente_id
  JOIN servicio s ON s.id = r.servicio_id
  JOIN recurso rc ON rc.id = r.recurso_id`;

function aReserva(fila) {
  return {
    id: fila.id,
    estado: fila.estado,
    version: fila.version,
    cantidadPersonas: fila.cantidad_personas,
    fecha: fila.fecha,
    horaInicio: fila.hora_inicio,
    horaFin: fila.hora_fin,
    inicio: fila.inicio,
    fin: fila.fin,
    cliente: { id: fila.cliente_id, nombre: fila.cliente_nombre, rut: fila.cliente_rut },
    servicio: { id: fila.servicio_id, nombre: fila.servicio_nombre, duracionMin: fila.duracion_min, precio: fila.precio },
    recurso: { id: fila.recurso_id, nombre: fila.recurso_nombre, tipo: fila.recurso_tipo },
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

// RF-18: consultar por fecha, recurso, cliente (id o búsqueda por nombre/RUT) y estado.
// Sin fecha: "proximas" muestra desde hoy en adelante; "todas" incluye las pasadas.
export async function listar({ fecha, periodo, recursoId, clienteId, estado, buscar, limite, desde }) {
  const nombre = buscar ? escaparLike(normalizarBusqueda(buscar)) : null; // sin tildes ni mayúsculas
  const rut = buscar ? escaparLike(buscar.replace(/[.\s-]/g, '').toUpperCase()) : '';
  const orden = !fecha && periodo === 'todas' ? 'DESC' : 'ASC';
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} ${ORIGEN}
      WHERE ($2::date IS NULL OR (r.inicio AT TIME ZONE $1::text)::date = $2::date)
        AND ($2::date IS NOT NULL OR $3::text = 'todas'
             OR r.inicio >= (date_trunc('day', now() AT TIME ZONE $1::text) AT TIME ZONE $1::text))
        AND ($4::uuid IS NULL OR r.recurso_id = $4::uuid)
        AND ($5::uuid IS NULL OR r.cliente_id = $5::uuid)
        AND ($6::text IS NULL OR r.estado = $6::text)
        AND ($7::text IS NULL
             OR ${sinTildesSql('c.nombre')} LIKE '%' || $7::text || '%'
             OR ($8::text <> '' AND replace(c.rut, '-', '') LIKE $8::text || '%'))
      ORDER BY r.inicio ${orden}, r.id
      LIMIT $9 OFFSET $10`,
    [ZONA_HORARIA, fecha, periodo, recursoId, clienteId, estado, nombre, rut, limite + 1, desde],
  );
  return { datos: rows.slice(0, limite).map(aReserva), hayMas: rows.length > limite };
}

export async function obtener(id, db = pool) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} ${ORIGEN} WHERE r.id = $2`, [ZONA_HORARIA, id]);
  return rows[0] ? aReserva(rows[0]) : null;
}

// Fecha y hora actuales en el centro termal.
export async function ahoraLocal(db = pool) {
  const { rows } = await db.query(
    `SELECT to_char(now() AT TIME ZONE $1::text, 'YYYY-MM-DD') AS hoy,
            to_char(now() AT TIME ZONE $1::text, 'HH24:MI') AS hora`,
    [ZONA_HORARIA],
  );
  return rows[0];
}

// Los bloqueos (FOR UPDATE) hacen que dos reservas simultáneas sobre el mismo recurso o cliente
// se procesen una después de la otra. Sin esto, ambas podrían ver el último cupo libre.
export async function bloquearCliente(db, id) {
  const { rows } = await db.query('SELECT id, estado FROM cliente WHERE id = $1 FOR UPDATE', [id]);
  return rows[0] ?? null;
}

export async function obtenerRecurso(id, db = pool) {
  const { rows } = await db.query('SELECT id, nombre, estado, capacidad_maxima FROM recurso WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function bloquearRecurso(db, id) {
  const { rows } = await db.query(
    'SELECT id, nombre, estado, capacidad_maxima FROM recurso WHERE id = $1 FOR UPDATE',
    [id],
  );
  return rows[0] ?? null;
}

export async function bloquearReserva(db, id) {
  const { rows } = await db.query(
    'SELECT id, cliente_id, estado, version, inicio, cantidad_personas FROM reserva WHERE id = $1 FOR UPDATE',
    [id],
  );
  return rows[0] ?? null;
}

// Reservas activas de un recurso en un día, en minutos desde la medianoche: [{ inicio, fin, personas }].
// excluirId: la reserva que se está reprogramando, para que no choque consigo misma.
export async function ocupacionDelDia(db = pool, { recursoId, fecha, excluirId = null }) {
  const { rows } = await db.query(
    `SELECT to_char(inicio AT TIME ZONE $1::text, 'HH24:MI') AS inicio,
            to_char(fin AT TIME ZONE $1::text, 'HH24:MI') AS fin,
            cantidad_personas
       FROM reserva
      WHERE recurso_id = $2
        AND estado = ANY ($3::text[])
        AND (inicio AT TIME ZONE $1::text)::date = $4::date
        AND ($5::uuid IS NULL OR id <> $5::uuid)`,
    [ZONA_HORARIA, recursoId, ESTADOS_ACTIVOS, fecha, excluirId],
  );
  return rows.map((f) => ({ inicio: aMinutos(f.inicio), fin: aMinutos(f.fin), personas: f.cantidad_personas }));
}

// ¿El cliente ya tiene otra reserva activa que se cruce con este horario (en cualquier recurso)?
export async function clienteTieneCruce(db, { clienteId, fecha, horaInicio, horaFin, excluirId = null }) {
  const { rows } = await db.query(
    `SELECT 1
       FROM reserva
      WHERE cliente_id = $2
        AND estado = ANY ($3::text[])
        AND inicio < (($4::date + $6::time) AT TIME ZONE $1::text)
        AND fin > (($4::date + $5::time) AT TIME ZONE $1::text)
        AND ($7::uuid IS NULL OR id <> $7::uuid)
      LIMIT 1`,
    [ZONA_HORARIA, clienteId, ESTADOS_ACTIVOS, fecha, horaInicio, horaFin, excluirId],
  );
  return rows.length > 0;
}

export async function crear(db, { clienteId, servicioId, recursoId, fecha, horaInicio, horaFin, cantidadPersonas = 1 }) {
  const { rows } = await db.query(
    `INSERT INTO reserva (cliente_id, servicio_id, recurso_id, inicio, fin, cantidad_personas)
     VALUES ($2, $3, $4,
             ($5::date + $6::time) AT TIME ZONE $1::text,
             ($5::date + $7::time) AT TIME ZONE $1::text,
             $8::int)
     RETURNING id`,
    [ZONA_HORARIA, clienteId, servicioId, recursoId, fecha, horaInicio, horaFin, cantidadPersonas],
  );
  return rows[0].id;
}

export async function reprogramar(db, id, { servicioId, recursoId, fecha, horaInicio, horaFin, cantidadPersonas }) {
  await db.query(
    `UPDATE reserva
        SET servicio_id = $3, recurso_id = $4,
            inicio = ($5::date + $6::time) AT TIME ZONE $1::text,
            fin = ($5::date + $7::time) AT TIME ZONE $1::text,
            cantidad_personas = $8::int,
            version = version + 1, actualizado_en = now()
      WHERE id = $2`,
    [ZONA_HORARIA, id, servicioId, recursoId, fecha, horaInicio, horaFin, cantidadPersonas],
  );
}

export async function cambiarEstado(db, id, estado) {
  await db.query(
    'UPDATE reserva SET estado = $2, version = version + 1, actualizado_en = now() WHERE id = $1',
    [id, estado],
  );
}

export async function eliminar(db, id) {
  await db.query('DELETE FROM reserva WHERE id = $1', [id]);
}

// Libera las reservas pendientes de pago cuyo plazo venció (PENDIENTE_PAGO -> LIBERADA), para que
// no bloqueen el cupo indefinidamente. Se llama antes de calcular disponibilidad y de registrar pagos.
// Devuelve cuántas liberó.
export async function liberarVencidas(db = pool) {
  const { rowCount } = await db.query(
    `UPDATE reserva
        SET estado = 'liberada', actualizado_en = now()
      WHERE estado = 'pendiente_pago'
        AND creado_en < now() - make_interval(mins => $1::int)`,
    [PLAZO_PAGO_MIN],
  );
  return rowCount;
}

// Reservas activas de un recurso que todavía no terminan, en minutos del día agrupables por fecha.
// Lo usa Recursos para no permitir cambios que dejarían esas reservas sin cupo.
export async function reservasFuturasDelRecurso(recursoId, db = pool) {
  const { rows } = await db.query(
    `SELECT to_char(inicio AT TIME ZONE $1::text, 'YYYY-MM-DD') AS fecha,
            to_char(inicio AT TIME ZONE $1::text, 'HH24:MI') AS inicio,
            to_char(fin AT TIME ZONE $1::text, 'HH24:MI') AS fin,
            cantidad_personas
       FROM reserva
      WHERE recurso_id = $2
        AND estado = ANY ($3::text[])
        AND fin > now()`,
    [ZONA_HORARIA, recursoId, ESTADOS_ACTIVOS],
  );
  return rows.map((f) => ({
    fecha: f.fecha, inicio: aMinutos(f.inicio), fin: aMinutos(f.fin), personas: f.cantidad_personas,
  }));
}
