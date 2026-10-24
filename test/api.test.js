// Pruebas de la API completa (rutas -> servicio -> repositorio -> PostgreSQL).
// Usan una base de datos aparte, "<tu_base>_test", que se crea y se reinicia sola al empezar:
// los datos reales de tu base de desarrollo nunca se tocan.
// Si PostgreSQL no está disponible, estas pruebas se omiten y el resto sigue funcionando.
// Ejecutar con: npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { calcularDv } from '../compartido/rut.js';

// Lee DATABASE_URL del archivo .env si no viene ya en el entorno.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // sin .env: se usa lo que haya en el entorno
}

let servidor;
let bd; // conexión directa a la base de prueba, para preparar datos que la API no crea (servicios)
let base;
let cerrarPool;
let omitir = false;

async function prepararBaseDePrueba() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL (archivo .env)');
  const url = new URL(process.env.DATABASE_URL);
  const nombreReal = decodeURIComponent(url.pathname.slice(1));
  const nombrePrueba = nombreReal.endsWith('_test') ? nombreReal : `${nombreReal}_test`;

  const administracion = new URL(url);
  administracion.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: administracion.toString(), connectionTimeoutMillis: 3000 });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombrePrueba]);
    if (rowCount === 0) await admin.query(`CREATE DATABASE "${nombrePrueba}"`);
  } finally {
    await admin.end();
  }

  url.pathname = `/${nombrePrueba}`;
  bd = new pg.Client({ connectionString: url.toString() });
  await bd.connect();
  // Solo en la base de prueba: se parte siempre desde cero, con el esquema actual.
  await bd.query('DROP TABLE IF EXISTS sesion, usuario, reserva, servicio_recurso, servicio, cliente, recurso CASCADE');
  await bd.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));

  // Una persona por rol, todas con la misma contraseña de prueba.
  const { hashear } = await import('../src/modulos/auth/clave.js');
  const hash = await hashear(CLAVE_PRUEBA);
  for (const rol of ['administrador', 'recepcionista', 'supervisor', 'mantenedor']) {
    await bd.query(
      'INSERT INTO usuario (nombre, correo, password_hash, rol) VALUES ($1, $2, $3, $4)',
      [`Prueba ${rol}`, correoDe(rol), hash, rol],
    );
  }
  process.env.DATABASE_URL = url.toString(); // el servidor de prueba usa solo la base de prueba
}

const CLAVE_PRUEBA = 'Prueba#2026';
const correoDe = (rol) => `${rol}@prueba.cl`;
let cookieAdmin = '';

try {
  await prepararBaseDePrueba();
  const { crearApp } = await import('../src/app.js');
  const { pool } = await import('../src/db.js');
  servidor = crearApp().listen(0);
  await new Promise((listo) => servidor.once('listening', listo));
  base = `http://127.0.0.1:${servidor.address().port}/api`;
  cerrarPool = () => pool.end();
  cookieAdmin = await iniciarSesion('administrador');
} catch (err) {
  omitir = `PostgreSQL no disponible para las pruebas de la API (${err.message || err.code})`;
}

after(async () => {
  if (servidor) await new Promise((listo) => servidor.close(listo));
  await cerrarPool?.();
  await bd?.end();
});

const opciones = { skip: omitir };

// Abre sesión y devuelve la cookie ("sid=...") para enviarla en las peticiones siguientes.
async function iniciarSesion(rol, clave = CLAVE_PRUEBA) {
  const respuesta = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: correoDe(rol), password: clave }),
  });
  if (respuesta.status !== 200) throw new Error(`no se pudo iniciar sesión como ${rol}: ${respuesta.status}`);
  return respuesta.headers.get('set-cookie').split(';')[0];
}

// cookie: por defecto la del administrador. Pasar '' para pedir sin sesión, o la cookie de otro rol.
async function pedir(metodo, ruta, cuerpo, cookie = cookieAdmin) {
  const cabeceras = cuerpo === undefined ? {} : { 'Content-Type': 'application/json' };
  if (cookie) cabeceras.Cookie = cookie;
  const respuesta = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  return { estado: respuesta.status, datos: texto ? JSON.parse(texto) : null, cabeceras: respuesta.headers };
}

// ---------- datos de prueba ----------

let contadorRut = 20_000_000;
const rutNuevo = () => {
  contadorRut += 1;
  return `${contadorRut}-${calcularDv(String(contadorRut))}`;
};

async function crearCliente(nombre, extra = {}) {
  const { estado, datos } = await pedir('POST', '/clientes', { nombre, rut: rutNuevo(), ...extra });
  assert.equal(estado, 201, JSON.stringify(datos));
  return datos;
}

let contadorRecurso = 0;
async function crearRecurso(capacidadMaxima, extra = {}) {
  contadorRecurso += 1;
  const { estado, datos } = await pedir('POST', '/recursos', {
    nombre: `Recurso de prueba ${contadorRecurso}`, tipo: 'sala', capacidadMaxima, ...extra,
  });
  assert.equal(estado, 201, JSON.stringify(datos));
  return datos;
}

// Los servicios no tienen API de escritura (solo consulta): se crean directo en la base de prueba.
let contadorServicio = 0;
async function crearServicio(duracionMin, recursos) {
  contadorServicio += 1;
  const { rows } = await bd.query(
    'INSERT INTO servicio (nombre, duracion_min, precio) VALUES ($1, $2, 10000) RETURNING id',
    [`Servicio de prueba ${contadorServicio}`, duracionMin],
  );
  for (const recurso of recursos) {
    await bd.query('INSERT INTO servicio_recurso (servicio_id, recurso_id) VALUES ($1, $2)', [rows[0].id, recurso.id]);
  }
  return rows[0].id;
}

// "AAAA-MM-DD" de dentro de "dias" días (se usan siempre 3 o más, para no depender de la zona horaria).
const fechaEn = (dias) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

async function crearReserva(cliente, servicioId, recurso, fecha, hora) {
  return pedir('POST', '/reservas', { clienteId: cliente.id, servicioId, recursoId: recurso.id, fecha, hora });
}

async function reservar(cliente, servicioId, recurso, fecha, hora) {
  const respuesta = await crearReserva(cliente, servicioId, recurso, fecha, hora);
  assert.equal(respuesta.estado, 201, JSON.stringify(respuesta.datos));
  return respuesta.datos;
}

// ---------- Clientes ----------

test('crear cliente: rechaza nombres con números o símbolos y acepta nombres reales', opciones, async () => {
  const malo = await pedir('POST', '/clientes', { nombre: '<script>1234', rut: rutNuevo() });
  assert.equal(malo.estado, 400);
  assert.ok(malo.datos.error.detalles.nombre);

  const bueno = await pedir('POST', '/clientes', { nombre: "María-José D'Angelo Núñez", rut: rutNuevo() });
  assert.equal(bueno.estado, 201);
});

test('buscar clientes ignora mayúsculas y tildes', opciones, async () => {
  const tomas = await crearCliente('Tomás Contreras Vera');
  for (const buscar of ['tomas', 'TOMÁS', 'contreras vera']) {
    const { datos } = await pedir('GET', `/clientes?buscar=${encodeURIComponent(buscar)}`);
    assert.ok(datos.datos.some((c) => c.id === tomas.id), `no encontró con "${buscar}"`);
  }
  const comodin = await pedir('GET', '/clientes?buscar=%25'); // % se busca como texto, no como comodín
  assert.equal(comodin.datos.datos.length, 0);
});

test('filtrar clientes por estado', opciones, async () => {
  const inactivo = await crearCliente('Persona Inactiva', { estado: 'inactivo' });
  await crearCliente('Persona Activa');
  const { datos } = await pedir('GET', '/clientes?estado=inactivo');
  assert.ok(datos.datos.length > 0);
  assert.ok(datos.datos.every((c) => c.estado === 'inactivo'));
  assert.ok(datos.datos.some((c) => c.id === inactivo.id));
  assert.equal((await pedir('GET', '/clientes?estado=roto')).estado, 400);
});

test('un método no soportado responde 405 con la cabecera Allow', opciones, async () => {
  const cliente = await crearCliente('Metodo Prueba');
  const lista = await pedir('PATCH', '/clientes', {});
  assert.equal(lista.estado, 405);
  assert.equal(lista.datos.error.codigo, 'METODO_NO_PERMITIDO');
  assert.equal(lista.cabeceras.get('allow'), 'GET, POST');
  assert.equal((await pedir('PATCH', `/clientes/${cliente.id}`, {})).cabeceras.get('allow'), 'GET, PUT, DELETE');
  assert.equal((await pedir('PATCH', '/recursos', {})).estado, 405);
  assert.equal((await pedir('PATCH', '/reservas', {})).estado, 405);
  assert.equal((await pedir('POST', '/servicios', {})).estado, 405);
});

// ---------- Reservas ----------

test('eliminar un cliente o un recurso con reservas responde 409 TIENE_DEPENDENCIAS', opciones, async () => {
  const cliente = await crearCliente('Cliente Con Historial');
  const recurso = await crearRecurso(4);
  const servicioId = await crearServicio(60, [recurso]);
  await reservar(cliente, servicioId, recurso, fechaEn(10), '10:00');

  const delCliente = await pedir('DELETE', `/clientes/${cliente.id}`);
  assert.equal(delCliente.estado, 409);
  assert.equal(delCliente.datos.error.codigo, 'TIENE_DEPENDENCIAS');
  const delRecurso = await pedir('DELETE', `/recursos/${recurso.id}`);
  assert.equal(delRecurso.estado, 409);
  assert.equal(delRecurso.datos.error.codigo, 'TIENE_DEPENDENCIAS');
});

test('una reserva pendiente se puede cancelar y queda en el historial; no se puede borrar una cancelada', opciones, async () => {
  const cliente = await crearCliente('Reserva Cancelable');
  const recurso = await crearRecurso(1);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(11);
  const reserva = await reservar(cliente, servicioId, recurso, fecha, '10:00');
  assert.equal(reserva.estado, 'pendiente_pago');

  const cancelada = await pedir('POST', `/reservas/${reserva.id}/cancelar`);
  assert.equal(cancelada.estado, 200);
  assert.equal(cancelada.datos.estado, 'cancelada');

  assert.equal((await pedir('GET', `/reservas/${reserva.id}`)).datos.estado, 'cancelada'); // sigue en el historial
  const borrar = await pedir('DELETE', `/reservas/${reserva.id}`);
  assert.equal(borrar.estado, 409);
  assert.equal(borrar.datos.error.codigo, 'ESTADO_NO_PERMITE');
  assert.equal((await pedir('POST', `/reservas/${reserva.id}/cancelar`)).datos.error.codigo, 'ESTADO_NO_PERMITE');

  await reservar(cliente, servicioId, recurso, fecha, '10:00'); // el cupo quedó libre
});

test('solo se elimina una reserva pendiente; una confirmada se cancela', opciones, async () => {
  const cliente = await crearCliente('Reserva Eliminable');
  const recurso = await crearRecurso(2);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(12);

  const pendiente = await reservar(cliente, servicioId, recurso, fecha, '09:00');
  assert.equal((await pedir('DELETE', `/reservas/${pendiente.id}`)).estado, 204);
  assert.equal((await pedir('GET', `/reservas/${pendiente.id}`)).estado, 404);

  const otra = await reservar(cliente, servicioId, recurso, fecha, '11:00');
  const pagada = await pedir('POST', `/reservas/${otra.id}/pago`);
  assert.equal(pagada.datos.estado, 'confirmada');
  const borrar = await pedir('DELETE', `/reservas/${otra.id}`);
  assert.equal(borrar.estado, 409);
  assert.equal((await pedir('POST', `/reservas/${otra.id}/cancelar`)).datos.estado, 'cancelada');
});

test('una reserva pendiente con el plazo de pago vencido se libera y libera el cupo', opciones, async () => {
  const primero = await crearCliente('Reserva Vencida');
  const segundo = await crearCliente('Reserva Siguiente');
  const recurso = await crearRecurso(1);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(13);
  const reserva = await reservar(primero, servicioId, recurso, fecha, '10:00');

  // Mientras está vigente, ocupa el cupo
  assert.equal((await crearReserva(segundo, servicioId, recurso, fecha, '10:00')).estado, 409);

  await bd.query("UPDATE reserva SET creado_en = now() - interval '31 minutes' WHERE id = $1", [reserva.id]);

  const pago = await pedir('POST', `/reservas/${reserva.id}/pago`); // el pago llega tarde
  assert.equal(pago.estado, 409);
  assert.equal((await pedir('GET', `/reservas/${reserva.id}`)).datos.estado, 'liberada');
  await reservar(segundo, servicioId, recurso, fecha, '10:00'); // y otra persona ya puede tomar el cupo
});

test('un recurso con reservas futuras no se puede poner en mantención ni bajarle la capacidad', opciones, async () => {
  const uno = await crearCliente('Recurso Reservado Uno');
  const dos = await crearCliente('Recurso Reservado Dos');
  const recurso = await crearRecurso(3);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(14);
  const primera = await reservar(uno, servicioId, recurso, fecha, '10:00');
  const segunda = await reservar(dos, servicioId, recurso, fecha, '10:30'); // se cruzan: 2 a la vez

  const cambiar = (extra) => pedir('PUT', `/recursos/${recurso.id}`, {
    nombre: recurso.nombre, tipo: recurso.tipo, capacidadMaxima: recurso.capacidadMaxima, estado: 'activo', ...extra,
  });

  const mantencion = await cambiar({ estado: 'en_mantencion' });
  assert.equal(mantencion.estado, 409);
  assert.equal(mantencion.datos.error.codigo, 'RECURSO_CON_RESERVAS');

  const poca = await cambiar({ capacidadMaxima: 1 });
  assert.equal(poca.estado, 409);
  assert.equal(poca.datos.error.codigo, 'CAPACIDAD_EN_USO');

  assert.equal((await cambiar({ capacidadMaxima: 2 })).estado, 200); // justo lo reservado a la vez: se permite

  await pedir('POST', `/reservas/${primera.id}/cancelar`);
  await pedir('POST', `/reservas/${segunda.id}/cancelar`);
  assert.equal((await cambiar({ capacidadMaxima: 1, estado: 'en_mantencion' })).estado, 200); // sin reservas, sí
});

test('no se reserva con más de un año de anticipación ni en el pasado', opciones, async () => {
  const cliente = await crearCliente('Reserva Fecha');
  const recurso = await crearRecurso(2);
  const servicioId = await crearServicio(60, [recurso]);

  const lejana = await crearReserva(cliente, servicioId, recurso, fechaEn(500), '10:00');
  assert.equal(lejana.estado, 400);
  assert.ok(lejana.datos.error.detalles.fecha);
  const pasada = await crearReserva(cliente, servicioId, recurso, fechaEn(-3), '10:00');
  assert.equal(pasada.estado, 400);
  assert.ok(pasada.datos.error.detalles.fecha);
});

test('sin cupo: 409 SIN_DISPONIBILIDAD con horarios sugeridos', opciones, async () => {
  const uno = await crearCliente('Cupo Uno');
  const dos = await crearCliente('Cupo Dos');
  const recurso = await crearRecurso(1);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(15);
  await reservar(uno, servicioId, recurso, fecha, '10:00');

  const sinCupo = await crearReserva(dos, servicioId, recurso, fecha, '10:30');
  assert.equal(sinCupo.estado, 409);
  assert.equal(sinCupo.datos.error.codigo, 'SIN_DISPONIBILIDAD');
  assert.ok(sinCupo.datos.error.sugerencias.includes('11:00'));
  assert.ok(!sinCupo.datos.error.sugerencias.includes('10:30'));
});

test('un cliente no puede tener dos reservas que se cruzan, ni siquiera en recursos distintos', opciones, async () => {
  const cliente = await crearCliente('Cliente Ocupado');
  const a = await crearRecurso(2);
  const b = await crearRecurso(2);
  const servicioA = await crearServicio(60, [a]);
  const servicioB = await crearServicio(60, [b]);
  const fecha = fechaEn(16);
  await reservar(cliente, servicioA, a, fecha, '10:00');
  const cruce = await crearReserva(cliente, servicioB, b, fecha, '10:30');
  assert.equal(cruce.estado, 409);
  assert.equal(cruce.datos.error.codigo, 'CLIENTE_OCUPADO');
});

test('seis reservas simultáneas por el último cupo: solo una se guarda', opciones, async () => {
  const clientes = await Promise.all(Array.from({ length: 6 }, (_, i) => crearCliente(`Carrera Cupo ${'ABCDEF'[i]}`)));
  const recurso = await crearRecurso(1);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(17);
  const respuestas = await Promise.all(clientes.map((c) => crearReserva(c, servicioId, recurso, fecha, '12:00')));
  assert.deepEqual(respuestas.map((r) => r.estado).sort(), [201, 409, 409, 409, 409, 409]);
});

test('los identificadores en mayúsculas se aceptan', opciones, async () => {
  const cliente = await crearCliente('Ids En Mayusculas');
  const recurso = await crearRecurso(2);
  const servicioId = await crearServicio(60, [recurso]);
  const respuesta = await pedir('POST', '/reservas', {
    clienteId: cliente.id.toUpperCase(),
    servicioId: servicioId.toUpperCase(),
    recursoId: recurso.id.toUpperCase(),
    fecha: fechaEn(18),
    hora: '10:00',
  });
  assert.equal(respuesta.estado, 201, JSON.stringify(respuesta.datos));
});

test('buscar reservas por nombre del cliente ignora tildes', opciones, async () => {
  const cliente = await crearCliente('Ángela Reservas');
  const recurso = await crearRecurso(2);
  const servicioId = await crearServicio(60, [recurso]);
  const reserva = await reservar(cliente, servicioId, recurso, fechaEn(19), '10:00');
  const { datos } = await pedir('GET', '/reservas?buscar=angela&periodo=todas');
  assert.ok(datos.datos.some((r) => r.id === reserva.id));
});

test('errores de formato: JSON inválido y ruta inexistente', opciones, async () => {
  const json = await fetch(`${base}/clientes`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieAdmin }, body: '{malo',
  });
  assert.equal(json.status, 400);
  assert.equal((await json.json()).error.codigo, 'JSON_INVALIDO');
  assert.equal((await pedir('GET', '/no-existe')).estado, 404);
});

// ---------- Reservas de grupo ----------

async function reservarGrupo(cliente, servicioId, recurso, fecha, hora, cantidadPersonas) {
  return pedir('POST', '/reservas', {
    clienteId: cliente.id, servicioId, recursoId: recurso.id, fecha, hora, cantidadPersonas,
  });
}

test('reserva de grupo: se guarda la cantidad de personas, y sin indicarla es 1', opciones, async () => {
  const cliente = await crearCliente('Grupo Basico');
  const recurso = await crearRecurso(10);
  const servicioId = await crearServicio(60, [recurso]);
  const grupo = await reservarGrupo(cliente, servicioId, recurso, fechaEn(23), '10:00', 4);
  assert.equal(grupo.estado, 201);
  assert.equal(grupo.datos.cantidadPersonas, 4);

  const individual = await crearReserva(await crearCliente('Grupo Sin Dato'), servicioId, recurso, fechaEn(23), '12:00');
  assert.equal(individual.datos.cantidadPersonas, 1);
});

test('reserva de grupo: la cantidad de personas se valida', opciones, async () => {
  const cliente = await crearCliente('Grupo Invalido');
  const recurso = await crearRecurso(6);
  const servicioId = await crearServicio(60, [recurso]);
  for (const valor of [0, -2, 2.5, '3', 1001]) {
    const r = await reservarGrupo(cliente, servicioId, recurso, fechaEn(24), '10:00', valor);
    assert.equal(r.estado, 400, `aceptó ${valor}`);
    assert.ok(r.datos.error.detalles.cantidadPersonas, `sin detalle para ${valor}`);
  }
  // Más personas que la capacidad del recurso: se explica, sin ofrecer horarios
  const demasiado = await reservarGrupo(cliente, servicioId, recurso, fechaEn(24), '10:00', 7);
  assert.equal(demasiado.estado, 400);
  assert.match(demasiado.datos.error.detalles.cantidadPersonas, /hasta 6/);
});

test('reserva de grupo: ocupa varios cupos y deja sin cupo a los demás', opciones, async () => {
  const uno = await crearCliente('Grupo Uno');
  const dos = await crearCliente('Grupo Dos');
  const tres = await crearCliente('Grupo Tres');
  const recurso = await crearRecurso(8);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(25);

  assert.equal((await reservarGrupo(uno, servicioId, recurso, fecha, '10:00', 5)).estado, 201); // quedan 3
  const noCabe = await reservarGrupo(dos, servicioId, recurso, fecha, '10:30', 4);
  assert.equal(noCabe.estado, 409);
  assert.equal(noCabe.datos.error.codigo, 'SIN_DISPONIBILIDAD');
  assert.ok(noCabe.datos.error.sugerencias.length > 0);
  assert.match(noCabe.datos.error.mensaje, /4 personas/);

  assert.equal((await reservarGrupo(dos, servicioId, recurso, fecha, '10:30', 3)).estado, 201); // justo lo que queda
  assert.equal((await reservarGrupo(tres, servicioId, recurso, fecha, '10:30', 1)).estado, 409); // ya está lleno

  // Los horarios con cupo dependen del tamaño del grupo
  const consultar = (personas) => pedir('GET', `/disponibilidad?servicioId=${servicioId}&recursoId=${recurso.id}&fecha=${fecha}&personas=${personas}`);
  assert.ok((await consultar(1)).datos.horarios.includes('11:00'));
  assert.ok(!(await consultar(1)).datos.horarios.includes('10:00'));
  assert.deepEqual((await consultar(9)).datos.horarios, []);
  assert.equal((await pedir('GET', `/disponibilidad?servicioId=${servicioId}&recursoId=${recurso.id}&fecha=${fecha}&personas=0`)).estado, 400);
});

test('reservas de grupo: cambiar el tamaño al reprogramar, y conservarlo si no se indica', opciones, async () => {
  const cliente = await crearCliente('Grupo Reprograma');
  const recurso = await crearRecurso(6);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(26);
  const reserva = (await reservarGrupo(cliente, servicioId, recurso, fecha, '10:00', 4)).datos;
  const base = { servicioId, recursoId: recurso.id, fecha };

  const sinCantidad = await pedir('PUT', `/reservas/${reserva.id}`, { ...base, hora: '11:00' });
  assert.equal(sinCantidad.datos.cantidadPersonas, 4); // se conserva

  const mas = await pedir('PUT', `/reservas/${reserva.id}`, { ...base, hora: '11:00', cantidadPersonas: 6 });
  assert.equal(mas.estado, 200);
  assert.equal(mas.datos.cantidadPersonas, 6);

  const demasiado = await pedir('PUT', `/reservas/${reserva.id}`, { ...base, hora: '11:00', cantidadPersonas: 7 });
  assert.equal(demasiado.estado, 400);
});

test('un recurso con reservas de grupo no baja su capacidad por debajo de las personas reservadas', opciones, async () => {
  const cliente = await crearCliente('Grupo Capacidad');
  const recurso = await crearRecurso(10);
  const servicioId = await crearServicio(60, [recurso]);
  await reservarGrupo(cliente, servicioId, recurso, fechaEn(27), '10:00', 6);
  const cambiar = (capacidadMaxima) => pedir('PUT', `/recursos/${recurso.id}`, {
    nombre: recurso.nombre, tipo: recurso.tipo, capacidadMaxima, estado: 'activo',
  });
  const rechazado = await cambiar(5);
  assert.equal(rechazado.estado, 409);
  assert.equal(rechazado.datos.error.codigo, 'CAPACIDAD_EN_USO');
  assert.equal((await cambiar(6)).estado, 200);
});

// ---------- Ediciones simultáneas e historial ----------

test('cliente: si dos personas editan a la vez, la segunda recibe 409 CONFLICTO_VERSION', opciones, async () => {
  const cliente = await crearCliente('Edicion Simultanea');
  assert.equal(cliente.version, 1);
  const cambio = (extra) => ({ nombre: cliente.nombre, rut: cliente.rut, estado: 'activo', ...extra });

  const primera = await pedir('PUT', `/clientes/${cliente.id}`, cambio({ nombre: 'Primera Persona', version: 1 }));
  assert.equal(primera.estado, 200);
  assert.equal(primera.datos.version, 2);

  const segunda = await pedir('PUT', `/clientes/${cliente.id}`, cambio({ nombre: 'Segunda Persona', version: 1 }));
  assert.equal(segunda.estado, 409);
  assert.equal(segunda.datos.error.codigo, 'CONFLICTO_VERSION');
  assert.equal((await pedir('GET', `/clientes/${cliente.id}`)).datos.nombre, 'Primera Persona'); // no se pisó

  // La versión es opcional: sin ella se guarda igual (compatibilidad con quien no la envía).
  assert.equal((await pedir('PUT', `/clientes/${cliente.id}`, cambio({ nombre: 'Sin Version' }))).estado, 200);
  assert.equal((await pedir('PUT', `/clientes/${cliente.id}`, cambio({ version: 'abc' }))).estado, 400);
});

test('reserva: reprogramar, pagar y cancelar con una versión vieja se rechaza', opciones, async () => {
  const cliente = await crearCliente('Reserva Version');
  const recurso = await crearRecurso(3);
  const servicioId = await crearServicio(60, [recurso]);
  const fecha = fechaEn(20);
  const reserva = await reservar(cliente, servicioId, recurso, fecha, '10:00');
  assert.equal(reserva.version, 1);

  const reprogramar = (hora, version) => pedir('PUT', `/reservas/${reserva.id}`, {
    servicioId, recursoId: recurso.id, fecha, hora, version,
  });
  const movida = await reprogramar('12:00', 1);
  assert.equal(movida.estado, 200);
  assert.equal(movida.datos.version, 2);

  const vieja = await reprogramar('14:00', 1); // otra persona la movió antes
  assert.equal(vieja.estado, 409);
  assert.equal(vieja.datos.error.codigo, 'CONFLICTO_VERSION');
  assert.equal((await pedir('GET', `/reservas/${reserva.id}`)).datos.horaInicio, '12:00');

  assert.equal((await pedir('POST', `/reservas/${reserva.id}/pago`, { version: 1 })).estado, 409);
  assert.equal((await pedir('POST', `/reservas/${reserva.id}/cancelar`, { version: 1 })).estado, 409);

  const pagada = await pedir('POST', `/reservas/${reserva.id}/pago`, { version: 2 });
  assert.equal(pagada.estado, 200);
  assert.equal(pagada.datos.version, 3);
  const cancelada = await pedir('POST', `/reservas/${reserva.id}/cancelar`, { version: 3 });
  assert.equal(cancelada.datos.estado, 'cancelada');
  assert.equal((await pedir('POST', `/reservas/${reserva.id}/cancelar`, { version: 'x' })).estado, 400);
});

test('historial del cliente: sus reservas de todos los estados y fechas', opciones, async () => {
  const cliente = await crearCliente('Cliente Historial');
  const otro = await crearCliente('Cliente Otro Historial');
  const recurso = await crearRecurso(5);
  const servicioId = await crearServicio(60, [recurso]);
  const pendiente = await reservar(cliente, servicioId, recurso, fechaEn(21), '10:00');
  const cancelada = await reservar(cliente, servicioId, recurso, fechaEn(22), '10:00');
  await pedir('POST', `/reservas/${cancelada.id}/cancelar`);
  await reservar(otro, servicioId, recurso, fechaEn(21), '12:00');

  const { estado, datos } = await pedir('GET', `/reservas?clienteId=${cliente.id}&periodo=todas&limite=100`);
  assert.equal(estado, 200);
  assert.deepEqual(datos.datos.map((r) => r.id).sort(), [pendiente.id, cancelada.id].sort());
  assert.ok(datos.datos.every((r) => r.cliente.id === cliente.id));
  assert.ok(datos.datos.some((r) => r.estado === 'cancelada'));
});

// ---------- Inicio de sesión y permisos ----------

async function iniciar(correo, password) {
  return fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo, password }),
  });
}

test('sin sesión la API responde 401, salvo /api/salud y el login', opciones, async () => {
  for (const ruta of ['/clientes', '/reservas', '/recursos', '/servicios', '/disponibilidad', '/auth/yo', '/no-existe']) {
    const r = await pedir('GET', ruta, undefined, '');
    assert.equal(r.estado, 401, `${ruta} debería exigir sesión`);
    assert.equal(r.datos.error.codigo, 'NO_AUTENTICADO');
  }
  assert.equal((await pedir('POST', '/clientes', { nombre: 'Sin Sesion', rut: rutNuevo() }, '')).estado, 401);
  assert.equal((await pedir('GET', '/salud', undefined, '')).estado, 200);
  // Una cookie inventada tampoco sirve
  assert.equal((await pedir('GET', '/clientes', undefined, 'sid=inventada')).estado, 401);
});

test('login correcto abre una sesión con cookie HttpOnly y no devuelve la contraseña', opciones, async () => {
  const respuesta = await iniciar(correoDe('recepcionista'), CLAVE_PRUEBA);
  assert.equal(respuesta.status, 200);
  const cookie = respuesta.headers.get('set-cookie');
  assert.match(cookie, /^sid=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.usuario.rol, 'recepcionista');
  assert.equal(cuerpo.usuario.correo, correoDe('recepcionista'));
  assert.ok(!JSON.stringify(cuerpo).includes('password'));

  const yo = await pedir('GET', '/auth/yo', undefined, cookie.split(';')[0]);
  assert.equal(yo.estado, 200);
  assert.equal(yo.datos.usuario.nombre, 'Prueba recepcionista');
  // El correo no distingue mayúsculas ni espacios
  assert.equal((await iniciar(`  ${correoDe('supervisor').toUpperCase()} `, CLAVE_PRUEBA)).status, 200);
});

test('login incorrecto: el mismo mensaje para correo inexistente, clave errónea y cuenta inactiva', opciones, async () => {
  const { hashear } = await import('../src/modulos/auth/clave.js');
  await bd.query(
    "INSERT INTO usuario (nombre, correo, password_hash, rol, estado) VALUES ('Persona Inactiva', 'inactivo@prueba.cl', $1, 'recepcionista', 'inactivo')",
    [await hashear(CLAVE_PRUEBA)],
  );
  const intentos = [
    [correoDe('administrador'), 'clave-equivocada'],
    ['nadie@prueba.cl', CLAVE_PRUEBA],
    ['inactivo@prueba.cl', CLAVE_PRUEBA], // la clave es correcta, pero la cuenta está inactiva
  ];
  const mensajes = new Set();
  for (const [correo, password] of intentos) {
    const respuesta = await iniciar(correo, password);
    assert.equal(respuesta.status, 401);
    assert.equal(respuesta.headers.get('set-cookie'), null);
    const cuerpo = await respuesta.json();
    assert.equal(cuerpo.error.codigo, 'CREDENCIALES_INVALIDAS');
    mensajes.add(cuerpo.error.mensaje);
  }
  assert.equal(mensajes.size, 1); // no se puede descubrir qué correos existen
});

test('login: datos incompletos responden 400', opciones, async () => {
  for (const cuerpo of [{}, { correo: 'a@b.cl' }, { password: 'x' }, { correo: 'a@b.cl', password: 'x'.repeat(300) }]) {
    const respuesta = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
    });
    assert.equal(respuesta.status, 400, JSON.stringify(cuerpo).slice(0, 40));
  }
});

test('cerrar sesión la invalida', opciones, async () => {
  const cookie = await iniciarSesion('mantenedor');
  assert.equal((await pedir('GET', '/recursos', undefined, cookie)).estado, 200);
  assert.equal((await pedir('POST', '/auth/logout', undefined, cookie)).estado, 204);
  assert.equal((await pedir('GET', '/recursos', undefined, cookie)).estado, 401);
  assert.equal((await pedir('GET', '/auth/yo', undefined, cookie)).estado, 401);
});

test('una sesión vencida o de un usuario desactivado deja de servir', opciones, async () => {
  const vencida = await iniciarSesion('supervisor');
  assert.equal((await pedir('GET', '/clientes', undefined, vencida)).estado, 200);
  await bd.query(
    "UPDATE sesion SET expira_en = now() - interval '1 minute' WHERE usuario_id = (SELECT id FROM usuario WHERE correo = $1)",
    [correoDe('supervisor')],
  );
  assert.equal((await pedir('GET', '/clientes', undefined, vencida)).estado, 401);

  const cookie = await iniciarSesion('mantenedor');
  await bd.query("UPDATE usuario SET estado = 'inactivo' WHERE correo = $1", [correoDe('mantenedor')]);
  assert.equal((await pedir('GET', '/recursos', undefined, cookie)).estado, 401);
  await bd.query("UPDATE usuario SET estado = 'activo' WHERE correo = $1", [correoDe('mantenedor')]);
});

test('cinco intentos fallidos bloquean el correo por un rato', opciones, async () => {
  const { reiniciarLimites } = await import('../src/modulos/auth/servicio.js');
  reiniciarLimites();
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await iniciar('atacante@prueba.cl', `clave-${i}`)).status, 401);
  }
  const bloqueado = await iniciar('atacante@prueba.cl', 'otra-clave');
  assert.equal(bloqueado.status, 429);
  assert.equal((await bloqueado.json()).error.codigo, 'DEMASIADOS_INTENTOS');
  // Otro correo no se ve afectado
  assert.equal((await iniciar(correoDe('administrador'), CLAVE_PRUEBA)).status, 200);
  reiniciarLimites();
});

test('las contraseñas se guardan con hash, nunca en texto', opciones, async () => {
  const { rows } = await bd.query('SELECT password_hash FROM usuario WHERE correo = $1', [correoDe('administrador')]);
  assert.match(rows[0].password_hash, /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.ok(!rows[0].password_hash.includes(CLAVE_PRUEBA));
  const sesiones = await bd.query('SELECT token_hash FROM sesion LIMIT 5');
  assert.ok(sesiones.rows.every((s) => /^[0-9a-f]{64}$/.test(s.token_hash))); // solo el hash del token
});

test('permisos por rol: Recepcionista gestiona clientes y reservas, no recursos', opciones, async () => {
  const cookie = await iniciarSesion('recepcionista');
  assert.equal((await pedir('GET', '/clientes', undefined, cookie)).estado, 200);
  const creado = await pedir('POST', '/clientes', { nombre: 'Creado Por Recepcion', rut: rutNuevo() }, cookie);
  assert.equal(creado.estado, 201);
  assert.equal((await pedir('GET', '/recursos', undefined, cookie)).estado, 200);
  assert.equal((await pedir('GET', '/servicios', undefined, cookie)).estado, 200);

  const recurso = await crearRecurso(3);
  const modificar = await pedir('PUT', `/recursos/${recurso.id}`, {
    nombre: recurso.nombre, tipo: recurso.tipo, capacidadMaxima: 4, estado: 'activo',
  }, cookie);
  assert.equal(modificar.estado, 403);
  assert.equal(modificar.datos.error.codigo, 'SIN_PERMISO');
  assert.equal((await pedir('POST', '/recursos', { nombre: 'Otro Recurso', tipo: 'sala', capacidadMaxima: 2 }, cookie)).estado, 403);
  assert.equal((await pedir('DELETE', `/recursos/${recurso.id}`, undefined, cookie)).estado, 403);
});

test('permisos por rol: Supervisor solo consulta', opciones, async () => {
  const cookie = await iniciarSesion('supervisor');
  for (const ruta of ['/clientes', '/reservas', '/recursos', '/servicios']) {
    assert.equal((await pedir('GET', ruta, undefined, cookie)).estado, 200, ruta);
  }
  const cliente = await crearCliente('Supervisado Por Supervisor');
  assert.equal((await pedir('POST', '/clientes', { nombre: 'No Debe Crear', rut: rutNuevo() }, cookie)).estado, 403);
  assert.equal((await pedir('PUT', `/clientes/${cliente.id}`, {
    nombre: 'Nombre Cambiado', rut: cliente.rut, estado: 'activo',
  }, cookie)).estado, 403);
  assert.equal((await pedir('DELETE', `/clientes/${cliente.id}`, undefined, cookie)).estado, 403);
  assert.equal((await pedir('POST', '/reservas/00000000-0000-4000-8000-000000000000/cancelar', {}, cookie)).estado, 403);
});

test('permisos por rol: Mantenedor administra recursos y no ve clientes ni reservas', opciones, async () => {
  const cookie = await iniciarSesion('mantenedor');
  const creado = await pedir('POST', '/recursos', { nombre: 'Creado Por Mantenedor', tipo: 'sala', capacidadMaxima: 5 }, cookie);
  assert.equal(creado.estado, 201);
  assert.equal((await pedir('GET', '/servicios', undefined, cookie)).estado, 200);
  for (const ruta of ['/clientes', '/reservas', '/disponibilidad']) {
    const r = await pedir('GET', ruta, undefined, cookie);
    assert.equal(r.estado, 403, ruta);
    assert.equal(r.datos.error.codigo, 'SIN_PERMISO');
  }
});
