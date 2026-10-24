// Reglas de negocio de Reservas como funciones puras: no tocan la base de datos,
// así se pueden probar con casos exactos (test/reservas.test.js).
import { ANTICIPACION_HORAS, HORARIO } from '../../../compartido/catalogos.js';
import { APERTURA_MIN, CIERRE_MIN, aHora } from '../../../compartido/horario.js';

// Cuántas personas hay al mismo tiempo, como máximo, dentro del intervalo [inicio, fin).
// reservas: [{ inicio, fin, personas }] en minutos del día; "personas" es la cantidad de personas
// de esa reserva (si falta, cuenta 1). Un intervalo que termina a las 11:00 no choca con otro que
// empieza a las 11:00.
export function ocupacionMaxima(reservas, inicio, fin) {
  const queSeCruzan = reservas.filter((r) => r.inicio < fin && r.fin > inicio);
  // La ocupación solo puede subir donde empieza una reserva, o al inicio del intervalo pedido.
  const puntos = [inicio, ...queSeCruzan.map((r) => r.inicio).filter((p) => p > inicio)];
  let maxima = 0;
  for (const punto of puntos) {
    const enUso = queSeCruzan
      .filter((r) => r.inicio <= punto && punto < r.fin)
      .reduce((suma, r) => suma + (r.personas ?? 1), 0);
    maxima = Math.max(maxima, enUso);
  }
  return maxima;
}

// RF-22: hay cupo si, sumando las "personas" de la nueva reserva, nunca se supera la capacidad
// del recurso. Una reserva de grupo ocupa tantos cupos como personas lleva.
export function hayCupo(reservas, inicio, fin, capacidad, personas = 1) {
  return ocupacionMaxima(reservas, inicio, fin) + personas <= capacidad;
}

// RF-23: todos los horarios de inicio con cupo en el día, en bloques de 15 minutos.
// desdeMin: no ofrecer horas anteriores a esta (para hoy, la hora actual).
export function horariosDisponibles({ reservas, capacidad, duracionMin, desdeMin = 0, personas = 1 }) {
  const horarios = [];
  for (let inicio = APERTURA_MIN; inicio + duracionMin <= CIERRE_MIN; inicio += HORARIO.bloqueMin) {
    if (inicio < desdeMin) continue;
    if (hayCupo(reservas, inicio, inicio + duracionMin, capacidad, personas)) horarios.push(aHora(inicio));
  }
  return horarios;
}

// RF-24: los horarios disponibles más cercanos al que se pidió, ordenados por hora.
export function sugerirHorarios({ solicitadoMin, cantidad = 3, ...datos }) {
  return horariosDisponibles(datos)
    .map((hora) => {
      const [h, m] = hora.split(':').map(Number);
      return { hora, distancia: Math.abs(h * 60 + m - solicitadoMin) };
    })
    .sort((a, b) => a.distancia - b.distancia || a.hora.localeCompare(b.hora))
    .slice(0, cantidad)
    .map((s) => s.hora)
    .sort();
}

// RF-19 y RF-20: se puede reprogramar o cancelar solo si faltan al menos 2 horas.
export function dentroDePlazo(inicio, ahora = new Date()) {
  return inicio.getTime() - ahora.getTime() >= ANTICIPACION_HORAS * 60 * 60 * 1000;
}
