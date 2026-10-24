// Capa de negocio de Cliente: decide qué significa cada resultado de la base de datos.
// Aquí irán reglas futuras, por ejemplo "no desactivar un cliente con reservas confirmadas".
import * as repositorio from './repositorio.js';
import { ErrorApp, noEncontrado, conflictoVersion, traducirErrorBD } from '../../errores.js';

const duplicados = {
  cliente_rut_unico: () =>
    new ErrorApp(409, 'RUT_DUPLICADO', 'Ya existe un cliente con ese RUT.', {
      rut: 'Ya existe un cliente con ese RUT.',
    }),
};

export function listar(filtros) {
  return repositorio.listar(filtros);
}

export async function obtener(id) {
  const cliente = await repositorio.obtener(id);
  if (!cliente) throw noEncontrado('El cliente');
  return cliente;
}

export async function crear(datos) {
  try {
    return await repositorio.crear(datos);
  } catch (err) {
    throw traducirErrorBD(err, duplicados);
  }
}

export async function actualizar(id, datos) {
  let cliente;
  try {
    cliente = await repositorio.actualizar(id, datos);
  } catch (err) {
    throw traducirErrorBD(err, duplicados);
  }
  if (cliente) return cliente;
  // No se actualizó nada: o el cliente no existe, o alguien lo modificó después de abrir el formulario.
  if (await repositorio.obtener(id)) throw conflictoVersion();
  throw noEncontrado('El cliente');
}

export async function eliminar(id) {
  let eliminado;
  try {
    eliminado = await repositorio.eliminar(id);
  } catch (err) {
    throw traducirErrorBD(err);
  }
  if (!eliminado) throw noEncontrado('El cliente');
}
