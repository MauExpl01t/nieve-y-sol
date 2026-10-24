// Utilidades de fecha y hora del centro termal. Las usan el navegador y el servidor.
// Las horas se manejan como texto "HH:MM" en la hora local del centro, y para calcular
// se convierten a minutos desde la medianoche (ej. "10:30" = 630).
import { HORARIO } from './catalogos.js';

export function aMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function aHora(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export const APERTURA_MIN = aMinutos(HORARIO.apertura);
export const CIERRE_MIN = aMinutos(HORARIO.cierre);

// "2026-10-08" -> válido solo si es una fecha real (rechaza 2026-02-30).
export function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

// "10:15" -> válido si es una hora real y cae en un bloque de 15 minutos.
export function esHoraDeBloque(texto) {
  if (typeof texto !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(texto)) return false;
  return aMinutos(texto) % HORARIO.bloqueMin === 0;
}

// Una reserva debe empezar y terminar dentro del horario de atención.
export function dentroDeHorario(inicioMin, finMin) {
  return inicioMin >= APERTURA_MIN && finMin <= CIERRE_MIN;
}
