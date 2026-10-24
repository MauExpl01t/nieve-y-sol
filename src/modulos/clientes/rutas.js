// Rutas HTTP de Cliente (RF-01 a RF-04).
// Esta capa solo traduce HTTP: valida la entrada, llama al servicio y elige el código de respuesta.
import { Router } from 'express';
import * as servicio from './servicio.js';
import { metodoNoPermitido } from '../../errores.js';
import { normalizarRut } from '../../../compartido/rut.js';
import { nombrePersonaValido, MENSAJE_NOMBRE_PERSONA } from '../../../compartido/texto.js';
import { ESTADOS_CLIENTE, NOMBRE } from '../../../compartido/catalogos.js';
import {
  leerId, leerTexto, leerOpcion, leerFiltro, leerBusqueda, leerPaginacion, leerVersionOpcional,
  lanzarSiHayErrores,
} from '../../validaciones.js';

// Solo se aceptan estos campos: aunque el cuerpo traiga otros (ej. password_hash), se ignoran.
function validarCliente(cuerpo, { esEdicion }) {
  const entrada = cuerpo ?? {};
  const errores = {};

  const nombre = leerTexto(entrada.nombre, NOMBRE);
  if (nombre.error) errores.nombre = nombre.error;
  else if (!nombrePersonaValido(nombre.valor)) errores.nombre = MENSAJE_NOMBRE_PERSONA;

  const rut = normalizarRut(entrada.rut);
  if (!rut) errores.rut = 'RUT inválido. Revisa el número y el dígito verificador.';

  // Al crear, el estado es opcional (por defecto "activo"). Al editar, es obligatorio.
  let estado = { valor: 'activo' };
  if (esEdicion || entrada.estado !== undefined) {
    estado = leerOpcion(entrada.estado, ESTADOS_CLIENTE);
    if (estado.error) errores.estado = estado.error;
  }

  // Al editar, la pantalla envía la versión que vio: así se detecta si otra persona lo cambió antes.
  const version = esEdicion ? leerVersionOpcional(entrada.version) : { valor: null };
  if (version.error) errores.version = version.error;

  lanzarSiHayErrores(errores);
  return { nombre: nombre.valor, rut, estado: estado.valor, version: version.valor };
}

export const rutasClientes = Router();

// RF-02: consultar / buscar clientes por nombre o RUT, y filtrar por estado
rutasClientes.get('/', async (req, res) => {
  const { limite, desde } = leerPaginacion(req.query);
  const filtros = {
    buscar: leerBusqueda(req.query.buscar),
    estado: leerFiltro(req.query.estado, ESTADOS_CLIENTE, 'estado'),
    limite,
    desde,
  };
  res.json(await servicio.listar(filtros));
});

rutasClientes.get('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'El cliente');
  res.json(await servicio.obtener(id));
});

// RF-01: crear cliente con nombre y RUT
rutasClientes.post('/', async (req, res) => {
  const datos = validarCliente(req.body, { esEdicion: false });
  res.status(201).json(await servicio.crear(datos));
});

// RF-03: modificar cliente
rutasClientes.put('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'El cliente');
  const datos = validarCliente(req.body, { esEdicion: true });
  res.json(await servicio.actualizar(id, datos));
});

// RF-04: eliminar cliente
rutasClientes.delete('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'El cliente');
  await servicio.eliminar(id);
  res.status(204).end();
});

// Cualquier otro método (PATCH, etc.) responde 405 en vez de "ruta no existe".
rutasClientes.all('/', metodoNoPermitido('GET, POST'));
rutasClientes.all('/:id', metodoNoPermitido('GET, PUT, DELETE'));
