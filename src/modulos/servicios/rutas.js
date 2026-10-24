// Rutas HTTP de Servicio: solo consulta, para elegir el servicio al reservar.
import { Router } from 'express';
import * as repositorio from './repositorio.js';
import { metodoNoPermitido } from '../../errores.js';

export const rutasServicios = Router();

rutasServicios.get('/', async (req, res) => {
  res.json({ datos: await repositorio.listarActivos() });
});

rutasServicios.all('/', metodoNoPermitido('GET'));
