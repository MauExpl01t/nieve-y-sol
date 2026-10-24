// Rutas HTTP de Recurso (RF-11 a RF-14).
import { Router } from 'express';
import * as servicio from './servicio.js';
import { metodoNoPermitido } from '../../errores.js';
import { TIPOS_RECURSO, ESTADOS_RECURSO, NOMBRE, CAPACIDAD } from '../../../compartido/catalogos.js';
import {
  leerId, leerTexto, leerEntero, leerOpcion, leerFiltro, leerBusqueda, leerPaginacion, lanzarSiHayErrores,
} from '../../validaciones.js';

function validarRecurso(cuerpo, { esEdicion }) {
  const entrada = cuerpo ?? {};
  const errores = {};

  const nombre = leerTexto(entrada.nombre, NOMBRE);
  if (nombre.error) errores.nombre = nombre.error;

  const tipo = leerOpcion(entrada.tipo, TIPOS_RECURSO);
  if (tipo.error) errores.tipo = tipo.error;

  // RF-11: capacidad máxima de personas
  const capacidad = leerEntero(entrada.capacidadMaxima, CAPACIDAD);
  if (capacidad.error) errores.capacidadMaxima = capacidad.error;

  let estado = { valor: 'activo' };
  if (esEdicion || entrada.estado !== undefined) {
    estado = leerOpcion(entrada.estado, ESTADOS_RECURSO);
    if (estado.error) errores.estado = estado.error;
  }

  lanzarSiHayErrores(errores);
  return { nombre: nombre.valor, tipo: tipo.valor, capacidadMaxima: capacidad.valor, estado: estado.valor };
}

export const rutasRecursos = Router();

// RF-12: consultar recursos, su estado y capacidad
rutasRecursos.get('/', async (req, res) => {
  const { limite, desde } = leerPaginacion(req.query);
  const filtros = {
    buscar: leerBusqueda(req.query.buscar),
    tipo: leerFiltro(req.query.tipo, TIPOS_RECURSO, 'tipo'),
    estado: leerFiltro(req.query.estado, ESTADOS_RECURSO, 'estado'),
    limite,
    desde,
  };
  res.json(await servicio.listar(filtros));
});

rutasRecursos.get('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'El recurso');
  res.json(await servicio.obtener(id));
});

// RF-11: registrar recurso
rutasRecursos.post('/', async (req, res) => {
  const datos = validarRecurso(req.body, { esEdicion: false });
  res.status(201).json(await servicio.crear(datos));
});

// RF-13: modificar recurso
rutasRecursos.put('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'El recurso');
  const datos = validarRecurso(req.body, { esEdicion: true });
  res.json(await servicio.actualizar(id, datos));
});

// RF-14: eliminar recurso
rutasRecursos.delete('/:id', async (req, res) => {
  const id = leerId(req.params.id, 'El recurso');
  await servicio.eliminar(id);
  res.status(204).end();
});

// Cualquier otro método (PATCH, etc.) responde 405 en vez de "ruta no existe".
rutasRecursos.all('/', metodoNoPermitido('GET, POST'));
rutasRecursos.all('/:id', metodoNoPermitido('GET, PUT, DELETE'));
