// Pruebas unitarias de contraseñas y permisos (no necesitan base de datos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashear, verificar, problemaDeClave } from '../src/modulos/auth/clave.js';
import { puede, PERMISOS, ROLES } from '../compartido/permisos.js';

test('hashear y verificar: la contraseña correcta coincide y las demás no', async () => {
  const hash = await hashear('MiClave#2026');
  assert.match(hash, /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verificar('MiClave#2026', hash), true);
  assert.equal(await verificar('miclave#2026', hash), false);
  assert.equal(await verificar('', hash), false);
});

test('dos hashes de la misma contraseña son distintos (sal aleatoria)', async () => {
  const [a, b] = await Promise.all([hashear('MismaClave#1'), hashear('MismaClave#1')]);
  assert.notEqual(a, b);
  assert.equal(await verificar('MismaClave#1', a), true);
  assert.equal(await verificar('MismaClave#1', b), true);
});

test('verificar rechaza hashes mal formados sin fallar', async () => {
  for (const malo of [null, undefined, '', 'texto-plano', 'scrypt$1$2$3', 'bcrypt$a$b$c$d$e']) {
    assert.equal(await verificar('x', malo), false, String(malo));
  }
});

test('reglas de contraseña', () => {
  assert.equal(problemaDeClave('Segura#2026'), null);
  assert.ok(problemaDeClave('corta'));
  assert.ok(problemaDeClave(''));
  assert.ok(problemaDeClave(undefined));
  assert.ok(problemaDeClave('x'.repeat(201)));
});

test('permisos: cada módulo tiene roles válidos y quien escribe también puede leer', () => {
  for (const [modulo, acciones] of Object.entries(PERMISOS)) {
    for (const rol of [...acciones.leer, ...acciones.escribir]) {
      assert.ok(Object.hasOwn(ROLES, rol), `${modulo}: rol desconocido "${rol}"`);
    }
    for (const rol of acciones.escribir) {
      assert.ok(acciones.leer.includes(rol), `${modulo}: ${rol} escribe pero no puede leer`);
    }
  }
});

test('permisos: lo que cada rol puede hacer', () => {
  // Administrador: todo
  for (const modulo of Object.keys(PERMISOS)) {
    assert.equal(puede('administrador', modulo, 'leer'), modulo !== undefined);
  }
  assert.equal(puede('administrador', 'clientes', 'escribir'), true);
  assert.equal(puede('administrador', 'recursos', 'escribir'), true);
  // Recepcionista
  assert.equal(puede('recepcionista', 'clientes', 'escribir'), true);
  assert.equal(puede('recepcionista', 'reservas', 'escribir'), true);
  assert.equal(puede('recepcionista', 'recursos', 'leer'), true);
  assert.equal(puede('recepcionista', 'recursos', 'escribir'), false);
  // Supervisor: solo consulta
  assert.equal(puede('supervisor', 'reservas', 'leer'), true);
  assert.equal(puede('supervisor', 'reservas', 'escribir'), false);
  assert.equal(puede('supervisor', 'clientes', 'escribir'), false);
  // Mantenedor: recursos y servicios; sin datos personales
  assert.equal(puede('mantenedor', 'recursos', 'escribir'), true);
  assert.equal(puede('mantenedor', 'servicios', 'escribir'), true);
  assert.equal(puede('mantenedor', 'clientes', 'leer'), false);
  assert.equal(puede('mantenedor', 'reservas', 'leer'), false);
  // Valores desconocidos nunca tienen permiso
  assert.equal(puede('invitado', 'clientes', 'leer'), false);
  assert.equal(puede('administrador', 'inexistente', 'leer'), false);
  assert.equal(puede('administrador', 'clientes', 'borrar'), false);
});
