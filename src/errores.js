// Manejo de errores de la API.
// Respuesta de error siempre con la misma forma: { error: { codigo, mensaje, detalles? } }
// - codigo: estable, el frontend decide qué hacer según este valor.
// - detalles: errores por campo, para marcarlos en el formulario.
// - extra: datos adicionales para el frontend (ej. sugerencias de horario).
import { log, datosError } from './log.js';

export class ErrorApp extends Error {
  constructor(estadoHttp, codigo, mensaje, detalles, extra) {
    super(mensaje);
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    this.detalles = detalles;
    this.extra = extra;
  }
}

export function noEncontrado(entidad) {
  return new ErrorApp(404, 'NO_ENCONTRADO', `${entidad} no existe.`);
}

// Dos personas editaron el mismo registro: la segunda guarda con una versión que ya no es la actual.
// El mensaje es neutro para que concuerde con cualquier registro (cliente, reserva...).
export function conflictoVersion() {
  return new ErrorApp(
    409,
    'CONFLICTO_VERSION',
    'Otra persona modificó estos datos mientras los editabas. Se recargó la lista: revisa los cambios y vuelve a intentar.',
  );
}

// Para rutas que existen pero no aceptan ese método HTTP (por ejemplo PATCH): responde 405.
export function metodoNoPermitido(permitidos) {
  return (req, res, next) => {
    res.set('Allow', permitidos);
    if (req.method === 'OPTIONS') return res.status(204).end();
    next(new ErrorApp(405, 'METODO_NO_PERMITIDO', `Esta ruta no acepta ${req.method}. Métodos permitidos: ${permitidos}.`));
  };
}

// Convierte errores conocidos de PostgreSQL en errores de negocio.
// Los que no conoce los deja pasar tal cual: terminarán como 500 y quedarán en el log.
export function traducirErrorBD(err, duplicados = {}) {
  if (err.code === '23505' && duplicados[err.constraint]) {
    return duplicados[err.constraint]();
  }
  // 23503: clave foránea (NO ACTION). 23001: clave foránea con ON DELETE RESTRICT, que es la que
  // usan las tablas de reservas. PostgreSQL les da códigos distintos para el mismo problema.
  if (err.code === '23503' || err.code === '23001') {
    return new ErrorApp(
      409,
      'TIENE_DEPENDENCIAS',
      'No se puede eliminar porque tiene registros asociados, como reservas. Márcalo como inactivo.',
    );
  }
  return err;
}

// Middleware final de Express. Los errores del usuario (4xx) se le explican;
// los del sistema (5xx) se registran completos y al usuario se le da un mensaje genérico.
export function manejadorErrores(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ErrorApp) {
    const cuerpo = { codigo: err.codigo, mensaje: err.message };
    if (err.detalles) cuerpo.detalles = err.detalles;
    if (err.extra) Object.assign(cuerpo, err.extra);
    return res.status(err.estadoHttp).json({ error: cuerpo });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido.' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { codigo: 'CUERPO_MUY_GRANDE', mensaje: 'La petición es demasiado grande.' } });
  }

  log('error', 'Error no controlado', {
    requestId: req.id,
    metodo: req.method,
    ruta: req.originalUrl.split('?')[0],
    ...datosError(err),
    stack: err.stack,
  });
  res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intenta nuevamente.' } });
}
