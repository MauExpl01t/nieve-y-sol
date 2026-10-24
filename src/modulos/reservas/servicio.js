// Capa de negocio de Reserva: aquí viven las reglas de disponibilidad y de estados.
// Cada operación que modifica datos corre en una transacción con bloqueos,
// para que dos personas no puedan tomar el mismo último cupo al mismo tiempo.
import * as repositorio from './repositorio.js';
import * as servicios from '../servicios/repositorio.js';
import { conTransaccion } from '../../db.js';
import { ErrorApp, noEncontrado, conflictoVersion, traducirErrorBD } from '../../errores.js';
import { lanzarSiHayErrores } from '../../validaciones.js';
import {
  hayCupo, horariosDisponibles, sugerirHorarios, dentroDePlazo, ocupacionMaxima,
} from './reglas.js';
import {
  ANTICIPACION_HORAS, ANTICIPACION_MAX_DIAS, ESTADOS_RECURSO, ESTADOS_RESERVA, HORARIO, permite,
} from '../../../compartido/catalogos.js';
import { aMinutos, aHora, dentroDeHorario } from '../../../compartido/horario.js';

// "2026-10-08" + 3 días = "2026-10-11". Se calcula en UTC para no depender de la zona del servidor.
function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

// Antes de consultar o validar, las reservas pendientes cuyo plazo de pago venció pasan a LIBERADA:
// así el cupo que ocupaban queda libre sin esperar a ningún proceso aparte.
export async function listar(filtros) {
  await repositorio.liberarVencidas();
  return repositorio.listar(filtros);
}

export async function obtener(id) {
  const reserva = await repositorio.obtener(id);
  if (!reserva) throw noEncontrado('La reserva');
  return reserva;
}

// RF-23: horarios con cupo para un servicio, en un recurso y una fecha, para un grupo de
// "cantidadPersonas" (por defecto 1).
export async function disponibilidad({ servicioId, recursoId, fecha, excluirId, cantidadPersonas = 1 }) {
  await repositorio.liberarVencidas();
  const servicio = await servicios.obtener(servicioId);
  if (!servicio || !servicio.activo) throw noEncontrado('El servicio');
  const recurso = await repositorio.obtenerRecurso(recursoId);
  if (!recurso) throw noEncontrado('El recurso');
  if (
    recurso.estado !== 'activo'
    || !servicio.recursoIds.includes(recursoId)
    || cantidadPersonas > recurso.capacidad_maxima // el grupo no cabe nunca en este recurso
  ) {
    return { fecha, horarios: [] };
  }
  const { hoy, hora } = await repositorio.ahoraLocal();
  if (fecha < hoy) return { fecha, horarios: [] };
  const reservas = await repositorio.ocupacionDelDia(undefined, { recursoId, fecha, excluirId });
  const horarios = horariosDisponibles({
    reservas,
    capacidad: recurso.capacidad_maxima,
    duracionMin: servicio.duracionMin,
    desdeMin: fecha === hoy ? aMinutos(hora) + 1 : 0,
    personas: cantidadPersonas,
  });
  return { fecha, horarios };
}

// Valida todo lo necesario para ocupar un recurso en una fecha y hora.
// Se usa al crear y al reprogramar. Debe llamarse dentro de una transacción.
async function validarHorario(db, {
  clienteId, servicioId, recursoId, fecha, hora, cantidadPersonas = 1, excluirId = null,
}) {
  const errores = {};

  // Orden fijo de bloqueos (cliente, luego recurso) para evitar bloqueos cruzados entre transacciones.
  const cliente = await repositorio.bloquearCliente(db, clienteId);
  if (!cliente) errores.clienteId = 'El cliente no existe.';
  else if (cliente.estado !== 'activo') errores.clienteId = 'El cliente está inactivo.';

  const servicio = await servicios.obtener(servicioId, db);
  if (!servicio || !servicio.activo) errores.servicioId = 'El servicio no existe o no está disponible.';

  const recurso = await repositorio.bloquearRecurso(db, recursoId);
  if (!recurso) {
    errores.recursoId = 'El recurso no existe.';
  } else if (recurso.estado !== 'activo') {
    errores.recursoId = `El recurso está ${ESTADOS_RECURSO[recurso.estado].toLowerCase()} y no recibe reservas.`;
  } else if (servicio && !servicio.recursoIds.includes(recursoId)) {
    errores.recursoId = 'Este recurso no ofrece el servicio elegido.';
  } else if (cantidadPersonas > recurso.capacidad_maxima) {
    // Un grupo más grande que el recurso no cabe en ningún horario: se explica en vez de ofrecer horarios.
    errores.cantidadPersonas = `${recurso.nombre} admite hasta ${recurso.capacidad_maxima} ${recurso.capacidad_maxima === 1 ? 'persona' : 'personas'} a la vez; el grupo es de ${cantidadPersonas}.`;
  }
  lanzarSiHayErrores(errores);

  const inicioMin = aMinutos(hora);
  const finMin = inicioMin + servicio.duracionMin;
  if (!dentroDeHorario(inicioMin, finMin)) {
    lanzarSiHayErrores({
      hora: `El centro atiende de ${HORARIO.apertura} a ${HORARIO.cierre}. Este servicio dura ${servicio.duracionMin} minutos, así que debe empezar a más tardar a las ${aHora(aMinutos(HORARIO.cierre) - servicio.duracionMin)}.`,
    });
  }

  const ahora = await repositorio.ahoraLocal(db);
  if (fecha < ahora.hoy) lanzarSiHayErrores({ fecha: 'La fecha ya pasó.' });
  if (fecha > sumarDias(ahora.hoy, ANTICIPACION_MAX_DIAS)) {
    lanzarSiHayErrores({ fecha: 'No se puede reservar con más de un año de anticipación.' });
  }
  if (fecha === ahora.hoy && inicioMin <= aMinutos(ahora.hora)) {
    lanzarSiHayErrores({ hora: 'Esa hora ya pasó. Elige una hora futura.' });
  }

  // RF-22: validar la capacidad máxima del recurso. RF-24: si no hay cupo, sugerir alternativas.
  const reservas = await repositorio.ocupacionDelDia(db, { recursoId, fecha, excluirId });
  if (!hayCupo(reservas, inicioMin, finMin, recurso.capacidad_maxima, cantidadPersonas)) {
    const sugerencias = sugerirHorarios({
      reservas,
      capacidad: recurso.capacidad_maxima,
      duracionMin: servicio.duracionMin,
      desdeMin: fecha === ahora.hoy ? aMinutos(ahora.hora) + 1 : 0,
      solicitadoMin: inicioMin,
      personas: cantidadPersonas,
    });
    const paraGrupo = cantidadPersonas > 1 ? ` para ${cantidadPersonas} personas` : '';
    throw new ErrorApp(
      409,
      'SIN_DISPONIBILIDAD',
      sugerencias.length > 0
        ? `${recurso.nombre} no tiene cupo${paraGrupo} a las ${hora}. Horarios cercanos con cupo: ${sugerencias.join(', ')}.`
        : `${recurso.nombre} no tiene cupo${paraGrupo} ese día para este servicio. Prueba otra fecha u otro recurso.`,
      undefined,
      { sugerencias },
    );
  }

  const horaFin = aHora(finMin);
  if (await repositorio.clienteTieneCruce(db, { clienteId, fecha, horaInicio: hora, horaFin, excluirId })) {
    throw new ErrorApp(409, 'CLIENTE_OCUPADO', 'El cliente ya tiene otra reserva que se cruza con ese horario.');
  }

  return { horaInicio: hora, horaFin };
}

// RF-15 y RF-16: crear una reserva. Queda pendiente de pago hasta registrar el pago (RF-25);
// si pasan PLAZO_PAGO_MIN minutos sin pago, se libera sola.
export async function crear(datos) {
  await repositorio.liberarVencidas();
  try {
    return await conTransaccion(async (db) => {
      const { horaInicio, horaFin } = await validarHorario(db, datos);
      const id = await repositorio.crear(db, { ...datos, horaInicio, horaFin });
      return repositorio.obtener(id, db);
    });
  } catch (err) {
    throw traducirErrorBD(err);
  }
}

// Bloquea la reserva y revisa que su estado permita la acción.
// version: la que vio quien actúa (opcional). Si otra persona ya la modificó, se rechaza con
// CONFLICTO_VERSION en vez de actuar sobre datos que esa persona ya no está viendo.
async function tomarReserva(db, id, accion, mensajeNoPermitido, version = null) {
  const reserva = await repositorio.bloquearReserva(db, id);
  if (!reserva) throw noEncontrado('La reserva');
  if (version != null && reserva.version !== version) throw conflictoVersion();
  if (!permite(reserva.estado, accion)) {
    throw new ErrorApp(
      409,
      'ESTADO_NO_PERMITE',
      `${mensajeNoPermitido} Estado actual: ${ESTADOS_RESERVA[reserva.estado]}.`,
    );
  }
  return reserva;
}

function exigirPlazo(reserva, accion) {
  if (!dentroDePlazo(reserva.inicio)) {
    throw new ErrorApp(
      409,
      'FUERA_DE_PLAZO',
      `Solo se puede ${accion} hasta ${ANTICIPACION_HORAS} horas antes de la hora reservada.`,
    );
  }
}

// RF-19: reprogramar (cambiar servicio, recurso, fecha u hora) respetando las 2 horas de anticipación.
// El cliente no cambia: si es otra persona, se crea otra reserva.
export async function reprogramar(id, datos) {
  await repositorio.liberarVencidas();
  try {
    return await conTransaccion(async (db) => {
      const reserva = await tomarReserva(
        db, id, 'reprogramar', 'Solo se pueden reprogramar reservas pendientes de pago o confirmadas.', datos.version,
      );
      exigirPlazo(reserva, 'reprogramar');
      // Si no se indica cuántas personas son, se conserva el tamaño del grupo de la reserva.
      const cantidadPersonas = datos.cantidadPersonas ?? reserva.cantidad_personas;
      const { horaInicio, horaFin } = await validarHorario(db, {
        ...datos, cantidadPersonas, clienteId: reserva.cliente_id, excluirId: id,
      });
      await repositorio.reprogramar(db, id, { ...datos, cantidadPersonas, horaInicio, horaFin });
      return repositorio.obtener(id, db);
    });
  } catch (err) {
    throw traducirErrorBD(err);
  }
}

// RF-25: registrar el pago deja la reserva en firme (PENDIENTE_PAGO -> CONFIRMADA).
// Mientras no se integre la pasarela (Sprint 3), recepción lo registra a mano (pago presencial).
export async function registrarPago(id, version = null) {
  // Si el plazo de pago ya venció, la reserva pasa a LIBERADA y el pago se rechaza (su cupo pudo
  // haberse ocupado). Esto se hace fuera de la transacción para que la liberación quede guardada.
  await repositorio.liberarVencidas();
  return conTransaccion(async (db) => {
    const reserva = await tomarReserva(
      db, id, 'registrarPago', 'Solo se registra el pago de reservas pendientes de pago.', version,
    );
    if (reserva.inicio.getTime() <= Date.now()) {
      throw new ErrorApp(409, 'RESERVA_VENCIDA', 'La hora de esta reserva ya pasó; no se puede confirmar.');
    }
    await repositorio.cambiarEstado(db, id, 'confirmada');
    return repositorio.obtener(id, db);
  });
}

// RF-20: cancelar una reserva pendiente de pago o confirmada, hasta 2 horas antes
// (PENDIENTE_PAGO o CONFIRMADA -> CANCELADA). La reserva no se borra: queda en el historial
// y libera el cupo.
export async function cancelar(id, version = null) {
  return conTransaccion(async (db) => {
    const reserva = await tomarReserva(
      db, id, 'cancelar', 'Solo se pueden cancelar reservas pendientes de pago o confirmadas.', version,
    );
    exigirPlazo(reserva, 'cancelar');
    await repositorio.cambiarEstado(db, id, 'cancelada');
    return repositorio.obtener(id, db);
  });
}

// Eliminar borra el registro. Solo se permite mientras la reserva sigue pendiente de pago (nunca
// se pagó, así que no hay nada que conservar). Las demás se cancelan, para que queden en el historial.
export async function eliminar(id) {
  await conTransaccion(async (db) => {
    await tomarReserva(
      db, id, 'eliminar',
      'Solo se pueden eliminar reservas pendientes de pago. Para las demás usa Cancelar: así quedan en el historial.',
    );
    await repositorio.eliminar(db, id);
  });
}

// Cuántas reservas futuras activas tiene un recurso y cuántas personas hay a la vez como máximo.
// Lo usa Recursos para no permitir cambios que dejarían esas reservas sin cupo.
export async function resumenFuturoDeRecurso(recursoId) {
  const reservas = await repositorio.reservasFuturasDelRecurso(recursoId);
  const porDia = new Map();
  for (const { fecha, inicio, fin, personas } of reservas) {
    if (!porDia.has(fecha)) porDia.set(fecha, []);
    porDia.get(fecha).push({ inicio, fin, personas });
  }
  let maxima = 0;
  for (const delDia of porDia.values()) {
    maxima = Math.max(maxima, ocupacionMaxima(delDia, 0, 24 * 60));
  }
  return { cantidad: reservas.length, maxima };
}
