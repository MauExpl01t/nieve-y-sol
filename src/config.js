// Configuración general. La zona horaria define cómo se interpretan las horas de reserva:
// "10:00" significa las 10:00 en el centro termal, aunque el servidor esté en otra zona.
export const ZONA_HORARIA = process.env.ZONA_HORARIA || 'America/Santiago';
