// Pruebas unitarias de las utilidades de texto (no necesitan base de datos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarBusqueda, nombrePersonaValido } from '../compartido/texto.js';
import { traducirErrorBD } from '../src/errores.js';
import { leerVersionOpcional } from '../src/validaciones.js';

test('leerVersionOpcional: opcional, y si viene debe ser un entero positivo', () => {
  assert.deepEqual(leerVersionOpcional(undefined), { valor: null });
  assert.deepEqual(leerVersionOpcional(null), { valor: null });
  assert.deepEqual(leerVersionOpcional(3), { valor: 3 });
  for (const malo of [0, -1, 1.5, '2', 'abc', true, 3_000_000_000]) {
    assert.ok(leerVersionOpcional(malo).error, String(malo));
  }
});

test('normalizarBusqueda quita tildes y mayúsculas', () => {
  assert.equal(normalizarBusqueda('Tomás Muñoz'), 'tomas munoz');
  assert.equal(normalizarBusqueda('ÁÉÍÓÚÜÑ'), 'aeiouun');
  assert.equal(normalizarBusqueda('Sauna 1'), 'sauna 1');
  // "á" escrita como "a" + tilde combinada (así llega a veces desde el teclado o al copiar)
  assert.equal(normalizarBusqueda('Tomás'), 'tomas');
});

test('nombrePersonaValido acepta nombres reales', () => {
  for (const nombre of ['Ana Soto', 'María José Núñez', "D'Angelo", 'Ana-María', 'Juan P. Pérez', 'Åsa Öberg']) {
    assert.equal(nombrePersonaValido(nombre), true, nombre);
  }
});

test('nombrePersonaValido rechaza números y símbolos', () => {
  for (const nombre of ['<script>1234', 'Ana 2', '1234', '-Ana', 'Ana@correo.cl', 'Ana_Soto', '']) {
    assert.equal(nombrePersonaValido(nombre), false, nombre);
  }
});

test('traducirErrorBD: eliminar algo con reservas es TIENE_DEPENDENCIAS con cualquiera de los dos códigos de PostgreSQL', () => {
  // 23503 = clave foránea normal; 23001 = clave foránea con ON DELETE RESTRICT (la de las reservas)
  for (const code of ['23503', '23001']) {
    const error = traducirErrorBD({ code });
    assert.equal(error.estadoHttp, 409);
    assert.equal(error.codigo, 'TIENE_DEPENDENCIAS');
  }
  const desconocido = new Error('otro');
  desconocido.code = '42P01';
  assert.equal(traducirErrorBD(desconocido), desconocido);
});
