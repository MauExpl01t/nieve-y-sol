// Rutas HTTP de Reserva (RF-15 a RF-25) y de Disponibilidad (RF-23).
// Esta capa solo traduce HTTP: valida la entrada, llama al servicio y elige el código de respuesta.
import { Router } from 'express';
import * as servicio from './servicio.js';
import { metodoNoPermitido } from '../../errores.js';
import { ESTADOS_RESERVA, CAPACIDAD } from '../../../compartido/catalogos.js';
import {
  leerId, leerUuid, leerUuidFiltro, leerFecha, leerFechaFiltro, leerHora, leerFiltro, leerEntero,
  leerBusqueda, leerPaginacion, leerVersionOpcional, lanzarSiHayErrores,
} from '../../validaciones.js';

const PERIODOS = { proximas: 'Próximas', todas: 'Todas' };

// Solo se aceptan estos campos; cualquier otro (ej. "estado") se ignora.
// El estado nunca se cambia por aquí: solo con las acciones registrar pago y cancelar.
function validarReserva(cuerpo, { conCliente }) {
  const entrada = cuerpo ?? {};
  const errores = {};
  const campos = {
    servicioId: leerUuid(entrada.servicioId, 'Elige un servicio.'),
    recursoId: leerUuid(entrada.recursoId, 'Elige un recurso.'),
    fecha: leerFecha(entrada.fecha),
    hora: leerHora(entrada.hora),
  };
  if (conCliente) campos.clienteId = leerUuid(entrada.clienteId, 'Elige un cliente.');
  // Al reprogramar, la pantalla envía la versión que vio: así se detecta si otra persona la cambió antes.
  if (!conCliente) campos.version = leerVersionOpcional(entrada.version);

  // Cantidad de personas del grupo. Si no se indica: al crear es 1, y al reprogramar (null) se
  // conserva la de la reserva.
  campos.cantidadPersonas = entrada.cantidadPersonas === undefined || entrada.cantidadPersonas === null
    ? { valor: conCliente ? 1 : null }
    : leerEntero(entrada.cantidadPersonas, CAPACIDAD);

  const datos = {};
  for (const [campo, { valor, error }] of Object.entries(campos)) {
    if (error) errores[campo] = error;
    else datos[campo] = valor;
  }
  lanzarSiHayErrores(errores);
  return datos;
}

// Versión opcional en el cuerpo de las acciones (pago, cancelar). Ver validarReserva.
function leerVersionDelCuerpo(cuerpo) {
  const { valor, error } = leerVersionOpcional(cuerpo?.version);
  lanzarSiHayErrores(error ? { version: error } : {});
  return valor;
}

export const rutasReservas = Router();

// RF-18: consultar reservas por fecha, recurso, cliente o estado.
rutasReservas.get('/', async (req, res) => {
  const { limite, desde } = leerPaginacion(req.query);
  const filtros = {
    fecha: leerFechaFiltro(req.query.fecha, 'fecha'),
    periodo: leerFiltro(req.query.periodo, PERIODOS, 'periodo') ?? 'proximas',
    recursoId: leerUuidFiltro(req.query.recursoId, 'recursoId'),
    clienteId: leerUuidFiltro(req.query.clienteId, 'clienteId'),
    estado: leerFiltro(req.query.estado, ESTADOS_RESERVA, 'estado'),
    buscar: leerBusqueda(req.query.buscar),
    limite,
    desde,
  };
  res.json(await servicio.listar(filtros));
});

rutasReservas.get('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'La reserva');
  res.json(await servicio.obtener(id));
});

// RF-15 y RF-16: crear una reserva (valida disponibilidad, RF-22).
rutasReservas.post('/', async (req, res) => {
  const datos = validarReserva(req.body, { conCliente: true });
  res.status(201).json(await servicio.crear(datos));
});

// RF-19: reprogramar una reserva.
rutasReservas.put('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'La reserva');
  const datos = validarReserva(req.body, { conCliente: false });
  res.json(await servicio.reprogramar(id, datos));
});

// RF-25: registrar el pago (deja la reserva confirmada).
rutasReservas.post('/:id/pago', async (req, res) => {
  const id = leerId(req.params.id, 'La reserva');
  res.json(await servicio.registrarPago(id, leerVersionDelCuerpo(req.body)));
});

// RF-20: cancelar una reserva pendiente de pago o confirmada (queda en el historial).
rutasReservas.post('/:id/cancelar', async (req, res) => {
  const id = leerId(req.params.id, 'La reserva');
  res.json(await servicio.cancelar(id, leerVersionDelCuerpo(req.body)));
});

// Eliminar el registro de una reserva (solo pendientes de pago: las demás se cancelan).
rutasReservas.delete('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'La reserva');
  await servicio.eliminar(id);
  res.status(204).end();
});

// Cualquier otro método (PATCH, etc.) responde 405 en vez de "ruta no existe".
rutasReservas.all('/', metodoNoPermitido('GET, POST'));
rutasReservas.all('/:id', metodoNoPermitido('GET, PUT, DELETE'));
rutasReservas.all('/:id/pago', metodoNoPermitido('POST'));
rutasReservas.all('/:id/cancelar', metodoNoPermitido('POST'));

export const rutasDisponibilidad = Router();

// RF-23: horarios con cupo para un servicio en un recurso y una fecha.
rutasDisponibilidad.get('/', async (req, res) => {
  const errores = {};
  const servicioId = leerUuid(req.query.servicioId, 'Elige un servicio.');
  const recursoId = leerUuid(req.query.recursoId, 'Elige un recurso.');
  const fecha = leerFecha(req.query.fecha);
  if (servicioId.error) errores.servicioId = servicioId.error;
  if (recursoId.error) errores.recursoId = recursoId.error;
  if (fecha.error) errores.fecha = fecha.error;
  // Tamaño del grupo (por defecto 1): los horarios que se devuelven tienen cupo para todas las personas.
  const personas = req.query.personas === undefined || req.query.personas === ''
    ? { valor: 1 }
    : leerEntero(Number(req.query.personas), CAPACIDAD);
  if (personas.error) errores.personas = personas.error;
  lanzarSiHayErrores(errores);
  const excluirId = leerUuidFiltro(req.query.excluirId, 'excluirId');
  res.json(await servicio.disponibilidad({
    servicioId: servicioId.valor,
    recursoId: recursoId.valor,
    fecha: fecha.valor,
    excluirId,
    cantidadPersonas: personas.valor,
  }));
});

rutasDisponibilidad.all('/', metodoNoPermitido('GET'));
