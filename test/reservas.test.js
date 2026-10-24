// Pruebas de las reglas de Reservas (disponibilidad, sugerencias y plazos). No necesitan base de datos.
// Las horas van en minutos desde la medianoche: 600 = 10:00.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ocupacionMaxima, hayCupo, horariosDisponibles, sugerirHorarios, dentroDePlazo,
} from '../src/modulos/reservas/reglas.js';
import { aMinutos, aHora, esFechaValida, esHoraDeBloque, dentroDeHorario } from '../compartido/horario.js';
import { permite } from '../compartido/catalogos.js';

const h = aMinutos;
const reserva = (inicio, fin) => ({ inicio: h(inicio), fin: h(fin) });

test('recurso de capacidad 1: no admite dos reservas que se cruzan', () => {
  const ocupado = [reserva('10:00', '11:00')];
  assert.equal(hayCupo(ocupado, h('10:30'), h('11:30'), 1), false);
  assert.equal(hayCupo(ocupado, h('09:30'), h('10:15'), 1), false);
  assert.equal(hayCupo(ocupado, h('10:15'), h('10:45'), 1), false); // dentro de la otra
});

test('una reserva que termina a las 11:00 no choca con otra que empieza a las 11:00', () => {
  const ocupado = [reserva('10:00', '11:00')];
  assert.equal(hayCupo(ocupado, h('11:00'), h('12:00'), 1), true);
  assert.equal(hayCupo(ocupado, h('09:00'), h('10:00'), 1), true);
});

test('recurso de capacidad 2: admite dos simultáneas y rechaza la tercera', () => {
  const ocupado = [reserva('10:00', '11:00'), reserva('10:30', '11:30')];
  assert.equal(ocupacionMaxima(ocupado, h('10:30'), h('11:00')), 2);
  assert.equal(hayCupo(ocupado, h('10:45'), h('11:15'), 2), false);
  assert.equal(hayCupo(ocupado, h('11:00'), h('12:00'), 2), true); // a las 11:00 queda solo una
});

test('dos reservas seguidas no suman ocupación: cuenta el máximo simultáneo, no el total', () => {
  // 10:00-10:30 y 10:30-11:00 nunca están al mismo tiempo: en 10:00-11:00 la ocupación máxima es 1.
  const ocupado = [reserva('10:00', '10:30'), reserva('10:30', '11:00')];
  assert.equal(ocupacionMaxima(ocupado, h('10:00'), h('11:00')), 1);
  assert.equal(hayCupo(ocupado, h('10:00'), h('11:00'), 2), true);
});

test('los horarios disponibles respetan el horario de atención y la duración', () => {
  const horarios = horariosDisponibles({ reservas: [], capacidad: 1, duracionMin: 60 });
  assert.equal(horarios[0], '09:00');
  assert.equal(horarios.at(-1), '20:00'); // un servicio de 60 min debe terminar a las 21:00
  assert.ok(horarios.every((hora) => h(hora) % 15 === 0));
});

test('los horarios disponibles excluyen los ocupados y las horas anteriores a "desde"', () => {
  const horarios = horariosDisponibles({
    reservas: [reserva('10:00', '11:00')], capacidad: 1, duracionMin: 60, desdeMin: h('09:30'),
  });
  assert.ok(!horarios.includes('09:15'));  // antes de "desde"
  assert.ok(!horarios.includes('09:45'));  // terminaría 10:45, cruza con 10:00-11:00
  assert.ok(!horarios.includes('09:30'));  // 09:30-10:30 también cruza
  assert.ok(horarios.includes('11:00'));
});

test('las sugerencias son los horarios libres más cercanos al pedido, ordenados', () => {
  const sugerencias = sugerirHorarios({
    reservas: [reserva('10:00', '11:00')], capacidad: 1, duracionMin: 60, solicitadoMin: h('10:30'),
  });
  assert.deepEqual(sugerencias, ['11:00', '11:15', '11:30']);

  // Si lo más cercano está antes de la hora pedida, también se sugiere.
  const antes = sugerirHorarios({
    reservas: [reserva('10:30', '11:30')], capacidad: 1, duracionMin: 60, solicitadoMin: h('10:00'),
  });
  assert.deepEqual(antes, ['09:00', '09:15', '09:30']);
});

test('sin cupo en todo el día no hay sugerencias', () => {
  const sugerencias = sugerirHorarios({
    reservas: [reserva('09:00', '21:00')], capacidad: 1, duracionMin: 60, solicitadoMin: h('10:00'),
  });
  assert.deepEqual(sugerencias, []);
});

test('plazo de 2 horas para reprogramar o cancelar', () => {
  const ahora = new Date('2026-10-08T12:00:00Z');
  assert.equal(dentroDePlazo(new Date('2026-10-08T14:00:00Z'), ahora), true);  // justo 2 horas
  assert.equal(dentroDePlazo(new Date('2026-10-08T13:59:00Z'), ahora), false); // 1 h 59 min
  assert.equal(dentroDePlazo(new Date('2026-10-08T11:00:00Z'), ahora), false); // ya pasó
});

test('validación de fecha y hora', () => {
  assert.equal(esFechaValida('2026-10-08'), true);
  assert.equal(esFechaValida('2026-02-30'), false);
  assert.equal(esFechaValida('08-10-2026'), false);
  assert.equal(esHoraDeBloque('10:15'), true);
  assert.equal(esHoraDeBloque('10:10'), false);
  assert.equal(esHoraDeBloque('25:00'), false);
  assert.equal(dentroDeHorario(h('20:00'), h('21:00')), true);
  assert.equal(dentroDeHorario(h('20:30'), h('21:30')), false);
  assert.equal(dentroDeHorario(h('08:45'), h('09:45')), false);
  assert.equal(aHora(h('09:05')), '09:05');
});

test('acciones permitidas según el estado de la reserva', () => {
  assert.equal(permite('pendiente_pago', 'registrarPago'), true);
  assert.equal(permite('confirmada', 'registrarPago'), false);
  assert.equal(permite('confirmada', 'cancelar'), true);
  assert.equal(permite('pendiente_pago', 'cancelar'), true); // una pendiente se cancela y queda en el historial
  assert.equal(permite('pendiente_pago', 'eliminar'), true); // solo una que nunca se pagó se puede borrar
  assert.equal(permite('confirmada', 'eliminar'), false);
  assert.equal(permite('cancelada', 'eliminar'), false); // el historial no se borra
  assert.equal(permite('liberada', 'eliminar'), false);
  assert.equal(permite('cancelada', 'reprogramar'), false);
  assert.equal(permite('completada', 'reprogramar'), false);
  assert.equal(permite('inventado', 'eliminar'), false);
});

// ---------- Reservas de grupo: cada reserva ocupa tantos cupos como personas lleva ----------

const grupo = (inicio, fin, personas) => ({ inicio: h(inicio), fin: h(fin), personas });

test('un grupo ocupa tantos cupos como personas lleva', () => {
  const ocupado = [grupo('10:00', '11:00', 3)];
  assert.equal(ocupacionMaxima(ocupado, h('10:00'), h('11:00')), 3);
  // Capacidad 8: caben 5 más, pero no 6
  assert.equal(hayCupo(ocupado, h('10:00'), h('11:00'), 8, 5), true);
  assert.equal(hayCupo(ocupado, h('10:00'), h('11:00'), 8, 6), false);
  // Sin indicar personas, la reserva nueva cuenta 1 (compatibilidad)
  assert.equal(hayCupo(ocupado, h('10:00'), h('11:00'), 4), true);
  assert.equal(hayCupo(ocupado, h('10:00'), h('11:00'), 3), false);
});

test('las reservas de grupo se suman solo cuando coinciden en el tiempo', () => {
  // 4 personas de 10 a 11 y 4 de 11 a 12: nunca hay más de 4 a la vez
  const ocupado = [grupo('10:00', '11:00', 4), grupo('11:00', '12:00', 4)];
  assert.equal(ocupacionMaxima(ocupado, h('10:00'), h('12:00')), 4);
  assert.equal(hayCupo(ocupado, h('10:30'), h('11:30'), 5, 1), true);
  // 4 de 10 a 12 y 3 de 11 a 13 coinciden entre 11 y 12: 7 a la vez
  assert.equal(ocupacionMaxima([grupo('10:00', '12:00', 4), grupo('11:00', '13:00', 3)], h('10:00'), h('13:00')), 7);
});

test('los horarios disponibles y las sugerencias consideran el tamaño del grupo', () => {
  const reservas = [grupo('10:00', '11:00', 5)]; // capacidad 8: quedan 3 cupos de 10 a 11
  const para2 = horariosDisponibles({ reservas, capacidad: 8, duracionMin: 60, personas: 2 });
  const para4 = horariosDisponibles({ reservas, capacidad: 8, duracionMin: 60, personas: 4 });
  assert.ok(para2.includes('10:00'));
  assert.ok(!para4.includes('10:00'));
  assert.ok(!para4.includes('09:15')); // 09:15-10:15 se cruza con las 5 personas
  assert.ok(para4.includes('11:00'));

  const sugerencias = sugerirHorarios({
    reservas, capacidad: 8, duracionMin: 60, personas: 4, solicitadoMin: h('10:00'),
  });
  assert.ok(sugerencias.every((hora) => hora === '09:00' || h(hora) >= h('11:00')));
  // Un grupo mayor que la capacidad no cabe en ningún horario
  assert.deepEqual(horariosDisponibles({ reservas: [], capacidad: 8, duracionMin: 60, personas: 9 }), []);
});
