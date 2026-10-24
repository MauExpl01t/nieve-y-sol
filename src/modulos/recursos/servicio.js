// Capa de negocio de Recurso.
import * as repositorio from './repositorio.js';
import { ErrorApp, noEncontrado, traducirErrorBD } from '../../errores.js';
import { resumenFuturoDeRecurso } from '../reservas/servicio.js';

const duplicados = {
  recurso_nombre_unico: () =>
    new ErrorApp(409, 'NOMBRE_DUPLICADO', 'Ya existe un recurso con ese nombre.', {
      nombre: 'Ya existe un recurso con ese nombre.',
    }),
};

export function listar(filtros) {
  return repositorio.listar(filtros);
}

export async function obtener(id) {
  const recurso = await repositorio.obtener(id);
  if (!recurso) throw noEncontrado('El recurso');
  return recurso;
}

export async function crear(datos) {
  try {
    return await repositorio.crear(datos);
  } catch (err) {
    throw traducirErrorBD(err, duplicados);
  }
}

// Un recurso con reservas futuras no puede dejar de estar activo ni bajar su capacidad por debajo
// de lo ya reservado: esas reservas quedarían apuntando a un recurso que no puede atenderlas.
// Primero hay que cancelarlas o reprogramarlas.
async function exigirQueNoHayaReservasIncompatibles(actual, datos) {
  const dejaDeEstarActivo = actual.estado === 'activo' && datos.estado !== 'activo';
  const bajaLaCapacidad = datos.capacidadMaxima < actual.capacidadMaxima;
  if (!dejaDeEstarActivo && !bajaLaCapacidad) return;

  const { cantidad, maxima } = await resumenFuturoDeRecurso(actual.id);
  if (dejaDeEstarActivo && cantidad > 0) {
    const mensaje = `Tiene ${cantidad} ${cantidad === 1 ? 'reserva futura' : 'reservas futuras'}. Cancélalas o reprográmalas antes de cambiar su estado.`;
    throw new ErrorApp(409, 'RECURSO_CON_RESERVAS', mensaje, { estado: mensaje });
  }
  if (bajaLaCapacidad && maxima > datos.capacidadMaxima) {
    const mensaje = `Hay reservas futuras con hasta ${maxima} ${maxima === 1 ? 'persona' : 'personas'} a la vez. La capacidad no puede ser menor a ${maxima}.`;
    throw new ErrorApp(409, 'CAPACIDAD_EN_USO', mensaje, { capacidadMaxima: mensaje });
  }
}

export async function actualizar(id, datos) {
  const actual = await repositorio.obtener(id);
  if (!actual) throw noEncontrado('El recurso');
  await exigirQueNoHayaReservasIncompatibles(actual, datos);

  let recurso;
  try {
    recurso = await repositorio.actualizar(id, datos);
  } catch (err) {
    throw traducirErrorBD(err, duplicados);
  }
  if (!recurso) throw noEncontrado('El recurso');
  return recurso;
}

export async function eliminar(id) {
  let eliminado;
  try {
    eliminado = await repositorio.eliminar(id);
  } catch (err) {
    throw traducirErrorBD(err);
  }
  if (!eliminado) throw noEncontrado('El recurso');
}
