// Listas cerradas del dominio. Las usan el servidor (para validar) y el navegador (para los selectores).
// Si se agrega un valor aquí, también hay que agregarlo en el CHECK de db/schema.sql.

export const NOMBRE = { min: 2, max: 120 };
export const CAPACIDAD = { min: 1, max: 1000 };

export const ESTADOS_CLIENTE = {
  activo: 'Activo',
  inactivo: 'Inactivo',
};

export const TIPOS_RECURSO = {
  sala: 'Sala',
  sauna: 'Sauna',
  piscina: 'Piscina',
  terapeuta: 'Terapeuta',
  instructor: 'Instructor',
};

export const ESTADOS_RECURSO = {
  activo: 'Activo',
  en_mantencion: 'En mantención',
  inactivo: 'Inactivo',
};

// Estados de Reserva, según el diagrama de estados de la Primera Entrega.
export const ESTADOS_RESERVA = {
  pendiente_pago: 'Pendiente de pago',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
  liberada: 'Liberada',
  no_show: 'No se presentó',
};

// Estados que ocupan el recurso. Las demás reservas ya no cuentan para la disponibilidad.
export const ESTADOS_ACTIVOS = ['pendiente_pago', 'confirmada'];

// Supuestos de operación (documentados en el README):
// el centro atiende de 09:00 a 21:00, en bloques de 15 minutos.
export const HORARIO = { apertura: '09:00', cierre: '21:00', bloqueMin: 15 };

// RF-19 y RF-20: reprogramar o cancelar solo hasta 2 horas antes de la hora reservada.
export const ANTICIPACION_HORAS = 2;

// No se puede reservar con más de un año de anticipación (evita errores de tipeo como 2099).
export const ANTICIPACION_MAX_DIAS = 365;

// Una reserva pendiente de pago se libera sola si pasan estos minutos sin registrar el pago
// (supuesto del informe: "no bloquear indefinidamente un recurso").
export const PLAZO_PAGO_MIN = 30;

// Qué acciones permite cada estado (diagrama de estados de Reserva).
// Cancelar conserva la reserva en el historial; eliminar la borra, por eso solo se permite
// mientras la reserva nunca se pagó (pendiente). Una reserva cancelada, liberada, completada
// o no_show queda como historial.
// COMPLETADA y NO_SHOW los asignan procesos automáticos (pendientes de implementar).
export const ACCIONES_POR_ESTADO = {
  pendiente_pago: ['registrarPago', 'reprogramar', 'cancelar', 'eliminar'],
  confirmada: ['reprogramar', 'cancelar'],
  cancelada: [],
  liberada: [],
  completada: [],
  no_show: [],
};

export function permite(estado, accion) {
  return (ACCIONES_POR_ESTADO[estado] ?? []).includes(accion);
}
