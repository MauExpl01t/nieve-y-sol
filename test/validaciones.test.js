// Pruebas unitarias de las reglas de validación (no necesitan base de datos).
// Ejecutar con: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarRut, formatearRut } from '../compartido/rut.js';
import { leerTexto, leerEntero, leerOpcion, leerPaginacion, leerId } from '../src/validaciones.js';
import { TIPOS_RECURSO } from '../compartido/catalogos.js';

test('RUT válido en distintos formatos se normaliza igual', () => {
  assert.equal(normalizarRut('12.345.678-5'), '12345678-5');
  assert.equal(normalizarRut('12345678-5'), '12345678-5');
  assert.equal(normalizarRut('123456785'), '12345678-5');
  assert.equal(normalizarRut(' 9.876.543-3 '), '9876543-3');
});

test('RUT con dígito verificador K, en minúscula o mayúscula', () => {
  assert.equal(normalizarRut('8.765.432-k'), '8765432-K');
  assert.equal(normalizarRut('8765432K'), '8765432-K');
});

test('RUT con dígito verificador incorrecto se rechaza', () => {
  assert.equal(normalizarRut('12.345.678-9'), null);
  assert.equal(normalizarRut('8765432-0'), null);
});

test('RUT con formato imposible se rechaza', () => {
  assert.equal(normalizarRut(''), null);
  assert.equal(normalizarRut('abc'), null);
  assert.equal(normalizarRut('123-4'), null);
  assert.equal(normalizarRut('01234567-8'), null);
  assert.equal(normalizarRut(12345678), null);
});

test('formatearRut agrega los puntos', () => {
  assert.equal(formatearRut('12345678-5'), '12.345.678-5');
  assert.equal(formatearRut('9876543-3'), '9.876.543-3');
});

test('leerTexto limpia espacios y respeta largo mínimo y máximo', () => {
  assert.deepEqual(leerTexto('  Ana   María  ', { min: 2, max: 10 }), { valor: 'Ana María' });
  assert.ok(leerTexto('A', { min: 2, max: 10 }).error);
  assert.ok(leerTexto('x'.repeat(11), { min: 2, max: 10 }).error);
  assert.ok(leerTexto(undefined, { min: 2, max: 10 }).error);
});

test('leerEntero rechaza decimales, texto y valores fuera de rango', () => {
  assert.deepEqual(leerEntero(8, { min: 1, max: 1000 }), { valor: 8 });
  assert.ok(leerEntero(0, { min: 1, max: 1000 }).error);
  assert.ok(leerEntero(2.5, { min: 1, max: 1000 }).error);
  assert.ok(leerEntero('8', { min: 1, max: 1000 }).error);
});

test('leerOpcion solo acepta valores de la lista cerrada', () => {
  assert.deepEqual(leerOpcion('sauna', TIPOS_RECURSO), { valor: 'sauna' });
  assert.ok(leerOpcion('jacuzzi', TIPOS_RECURSO).error);
  assert.ok(leerOpcion('toString', TIPOS_RECURSO).error); // no acepta propiedades heredadas
});

test('leerPaginacion usa valores por defecto y rechaza límites fuera de rango', () => {
  assert.deepEqual(leerPaginacion({}), { limite: 50, desde: 0 });
  assert.throws(() => leerPaginacion({ limite: '500' }), { codigo: 'VALIDACION' });
  assert.throws(() => leerPaginacion({ desde: '-1' }), { codigo: 'VALIDACION' });
});

test('leerId responde 404 si el id no tiene formato UUID', () => {
  assert.equal(leerId('3f1c2a9e-8b7d-4c6e-9f10-1a2b3c4d5e6f', 'El cliente'), '3f1c2a9e-8b7d-4c6e-9f10-1a2b3c4d5e6f');
  assert.throws(() => leerId('1 OR 1=1', 'El cliente'), { estadoHttp: 404, codigo: 'NO_ENCONTRADO' });
});
